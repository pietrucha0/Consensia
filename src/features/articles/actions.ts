'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/generated/prisma/client';
import { routing, type Locale } from '@/i18n/routing';
import { recordAudit } from '@/lib/audit';
import { getSessionWithRole } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { deleteUpload, UPLOAD_URL_PREFIX } from '@/lib/storage';

import { isRichTextEmpty, parseRichText, type RichTextDoc } from './rich-text';
import { articleFormSchema, type ArticleFormValues } from './schemas';

export type ArticleActionError = 'forbidden' | 'validation' | 'slug_taken' | 'not_found' | 'generic';
export type ArticleActionResult = { ok: true } | { ok: false; error: ArticleActionError };

const ARTICLE_EDITORS = ['ADMIN'] as const;

const localeField = z.enum(routing.locales);
const saveInputSchema = z.object({
  locale: localeField,
  id: z.string().min(1).max(64).optional(),
  values: articleFormSchema,
});

type TranslationWrite = {
  title: string;
  summary: string;
  body: RichTextDoc;
  footer: string | null;
  heroImageAlt: string | null;
};

/** Only languages that were filled in; empty tabs are dropped (and deleted on update). */
function toTranslationWrites(values: ArticleFormValues): Map<Locale, TranslationWrite> {
  const writes = new Map<Locale, TranslationWrite>();
  for (const locale of routing.locales) {
    const t = values.translations[locale];
    const body = parseRichText(t.body);
    if (t.title === '' || body === null || isRichTextEmpty(body)) continue;
    writes.set(locale, {
      title: t.title,
      summary: t.summary,
      body,
      footer: t.footer || null,
      heroImageAlt: t.heroImageAlt || null,
    });
  }
  return writes;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function revalidateArticles(): void {
  revalidatePath('/[locale]', 'layout');
}

// ── Create / update ───────────────────────────────────────────────────────────

export async function saveArticleAction(input: unknown): Promise<ArticleActionResult> {
  const session = await getSessionWithRole(ARTICLE_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };

  const parsed = saveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { locale, id, values } = parsed.data;

  const slugOwner = await prisma.article.findUnique({ where: { slug: values.slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== id) return { ok: false, error: 'slug_taken' };

  const translations = toTranslationWrites(values);
  const heroImageUrl = values.heroImageUrl || null;
  const auditLabel = [...translations.values()][0]?.title ?? values.slug;

  try {
    if (!id) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.article.create({
          select: { id: true },
          data: {
            slug: values.slug,
            status: values.status,
            heroImageUrl,
            authorId: session.user.id,
            publishedAt: values.status === 'PUBLISHED' ? new Date() : null,
            translations: {
              create: [...translations].map(([translationLocale, t]) => ({ locale: translationLocale, ...t })),
            },
          },
        });
        const target = { actorId: session.user.id, targetId: created.id, targetLabel: auditLabel };
        await recordAudit({ ...target, action: 'ARTICLE_CREATED' }, tx);
        if (values.status === 'PUBLISHED') await recordAudit({ ...target, action: 'ARTICLE_PUBLISHED' }, tx);
      });
    } else {
      const previousHero = await prisma.$transaction(async (tx) => {
        const existing = await tx.article.findUnique({
          where: { id },
          select: { status: true, publishedAt: true, heroImageUrl: true },
        });
        if (!existing) return undefined;

        await tx.article.update({
          where: { id },
          data: {
            slug: values.slug,
            status: values.status,
            heroImageUrl,
            // First publication stamps the date; later edits keep the original.
            ...(values.status === 'PUBLISHED' && !existing.publishedAt && { publishedAt: new Date() }),
          },
        });

        for (const translationLocale of routing.locales) {
          const t = translations.get(translationLocale);
          if (t) {
            await tx.articleTranslation.upsert({
              where: { articleId_locale: { articleId: id, locale: translationLocale } },
              create: { articleId: id, locale: translationLocale, ...t },
              update: t,
            });
          } else {
            await tx.articleTranslation.deleteMany({ where: { articleId: id, locale: translationLocale } });
          }
        }

        const target = { actorId: session.user.id, targetId: id, targetLabel: auditLabel };
        const statusChanged = existing.status !== values.status;
        await recordAudit(
          {
            ...target,
            action: 'ARTICLE_UPDATED',
            ...(statusChanged && { metadata: { from: existing.status, to: values.status } }),
          },
          tx,
        );
        if (statusChanged && values.status === 'PUBLISHED') await recordAudit({ ...target, action: 'ARTICLE_PUBLISHED' }, tx);
        return existing.heroImageUrl;
      });

      if (previousHero === undefined) return { ok: false, error: 'not_found' };
      if (previousHero && previousHero !== heroImageUrl) after(() => deleteUploadIfUnused(previousHero));
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: 'slug_taken' };
    console.error('[articles] save failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateArticles();
  if (!id) redirect(`/${locale}/admin/articles?notice=created`);
  return { ok: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteArticleAction(input: unknown): Promise<ArticleActionResult> {
  const session = await getSessionWithRole(ARTICLE_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };

  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const article = await tx.article.delete({
        where: { id: parsed.data.id },
        select: { slug: true, heroImageUrl: true, translations: { select: { title: true }, take: 1 } },
      });
      await recordAudit(
        {
          actorId: session.user.id,
          action: 'ARTICLE_DELETED',
          targetId: parsed.data.id,
          targetLabel: article.translations[0]?.title ?? article.slug,
        },
        tx,
      );
      return article;
    });
    const hero = deleted.heroImageUrl;
    if (hero) after(() => deleteUploadIfUnused(hero));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { ok: false, error: 'not_found' };
    }
    console.error('[articles] delete failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateArticles();
  return { ok: true };
}

/** Removes an uploaded file once no article or resolution points at it anymore. */
async function deleteUploadIfUnused(url: string): Promise<void> {
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return;
  const [articles, resolutions] = await Promise.all([
    prisma.article.count({ where: { heroImageUrl: url } }),
    prisma.resolution.count({ where: { imageUrl: url } }),
  ]);
  if (articles + resolutions === 0) {
    await deleteUpload(url).catch((error: unknown) => console.error('[uploads] cleanup failed', error));
  }
}
