'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';

import { env } from '@/env';
import { Prisma } from '@/generated/prisma/client';
import { routing } from '@/i18n/routing';
import { recordAudit } from '@/lib/audit';
import { getSession, getSessionWithRole } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { zonedDateTimeToUtc } from '@/lib/time-zone';

import { prepareResolutionEmails } from './notifications';
import { countEligibleVoters, resolutionAuditLabel } from './queries';
import { resolutionFormSchema, voteInputSchema, type ResolutionFormValues } from './schemas';

export type ResolutionActionError =
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'locked'
  | 'incomplete'
  | 'deadline_past'
  | 'generic';
export type ResolutionActionResult = { ok: true } | { ok: false; error: ResolutionActionError };

export type VoteError = 'unauthorized' | 'validation' | 'already_voted' | 'closed' | 'invalid_option' | 'generic';
export type VoteResult = { ok: true } | { ok: false; error: VoteError };

const RESOLUTION_EDITORS = ['ADMIN', 'MODERATOR'] as const;
const idSchema = z.object({ id: z.string().min(1).max(64) });

function revalidateResolutions(): void {
  revalidatePath('/[locale]', 'layout');
}

/**
 * Raised by the database triggers (prisma/migrations): a locked resolution, a closed
 * vote window. Driver adapters surface them with the message text, not a Prisma code.
 */
function databaseRejection(error: unknown): 'locked' | 'closed' | null {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes('is not open for voting')) return 'closed';
  if (text.includes('is locked after opening') || text.includes('cannot move from') || text.includes('is closed and cannot change')) {
    return 'locked';
  }
  return null;
}

// ── Create / update (DRAFT only) ──────────────────────────────────────────────

function toWriteData(values: ResolutionFormValues) {
  const filledLocales = routing.locales.filter((l) => values.translations[l].title.trim() !== '');
  return {
    reference: values.reference.trim() || null,
    imageUrl: values.imageUrl.trim() || null,
    attachmentUrl: values.attachmentUrl.trim() || null,
    closesAt: values.closesAt ? zonedDateTimeToUtc(values.closesAt, env.APP_TIME_ZONE) : null,
    translations: filledLocales.map((locale) => ({
      locale,
      title: values.translations[locale].title.trim(),
      description: values.translations[locale].description.trim(),
    })),
    options: values.options.map((option, order) => ({
      order,
      translations: {
        create: routing.locales
          .filter((l) => option.labels[l].trim() !== '')
          .map((locale) => ({ locale, label: option.labels[locale].trim() })),
      },
    })),
  };
}

export async function saveResolutionAction(input: unknown): Promise<ResolutionActionResult> {
  const session = await getSessionWithRole(RESOLUTION_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };

  const parsed = z
    .object({ locale: z.enum(routing.locales), id: z.string().min(1).max(64).optional(), values: resolutionFormSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { locale, id, values } = parsed.data;
  const { translations, options, ...fields } = toWriteData(values);
  const firstTitle = translations[0]?.title ?? '';
  const auditLabel = fields.reference ? `${fields.reference} · ${firstTitle}` : firstTitle;

  try {
    if (!id) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.resolution.create({
          select: { id: true },
          data: {
            ...fields,
            createdById: session.user.id,
            translations: { create: translations },
            options: { create: options },
          },
        });
        await recordAudit(
          { actorId: session.user.id, action: 'RESOLUTION_CREATED', targetId: created.id, targetLabel: auditLabel },
          tx,
        );
      });
    } else {
      const outcome = await prisma.$transaction(async (tx) => {
        const existing = await tx.resolution.findUnique({ where: { id }, select: { status: true } });
        if (!existing) return 'not_found' as const;
        if (existing.status !== 'DRAFT') return 'locked' as const;
        await tx.resolution.update({ where: { id }, data: fields });
        await tx.resolutionTranslation.deleteMany({ where: { resolutionId: id } });
        await tx.resolutionTranslation.createMany({ data: translations.map((t) => ({ ...t, resolutionId: id })) });
        await tx.voteOption.deleteMany({ where: { resolutionId: id } }); // cascades to option labels
        for (const option of options) await tx.voteOption.create({ data: { ...option, resolutionId: id } });
        await recordAudit(
          { actorId: session.user.id, action: 'RESOLUTION_UPDATED', targetId: id, targetLabel: auditLabel },
          tx,
        );
        return 'ok' as const;
      });
      if (outcome !== 'ok') return { ok: false, error: outcome };
    }
  } catch (error) {
    const rejection = databaseRejection(error);
    if (rejection === 'locked') return { ok: false, error: 'locked' };
    console.error('[resolutions] save failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateResolutions();
  if (!id) redirect(`/${locale}/admin/resolutions?notice=created`);
  return { ok: true };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function openResolutionAction(input: unknown): Promise<ResolutionActionResult> {
  const session = await getSessionWithRole(RESOLUTION_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const resolution = await prisma.resolution.findUnique({
    where: { id: parsed.data.id },
    select: { status: true, closesAt: true, _count: { select: { options: true, translations: true } } },
  });
  if (!resolution) return { ok: false, error: 'not_found' };
  if (resolution.status !== 'DRAFT') return { ok: false, error: 'locked' };
  if (resolution._count.options < 2 || resolution._count.translations === 0) return { ok: false, error: 'incomplete' };
  if (resolution.closesAt && resolution.closesAt <= new Date()) return { ok: false, error: 'deadline_past' };

  const opened = await prisma.$transaction(async (tx) => {
    const updated = await tx.resolution.updateMany({
      where: { id: parsed.data.id, status: 'DRAFT' },
      data: { status: 'ACTIVE', openedAt: new Date() },
    });
    if (updated.count !== 1) return false;
    await recordAudit(
      {
        actorId: session.user.id,
        action: 'RESOLUTION_OPENED',
        targetId: parsed.data.id,
        targetLabel: await resolutionAuditLabel(parsed.data.id, tx),
      },
      tx,
    );
    return true;
  });
  if (!opened) return { ok: false, error: 'locked' };

  after(await prepareResolutionEmails(parsed.data.id, 'opened'));
  revalidateResolutions();
  return { ok: true };
}

export async function closeResolutionAction(input: unknown): Promise<ResolutionActionResult> {
  const session = await getSessionWithRole(RESOLUTION_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const eligibleVoterCount = await countEligibleVoters();
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.resolution.updateMany({
        where: { id: parsed.data.id, status: 'ACTIVE' },
        data: { status: 'CLOSED', closedAt: new Date(), eligibleVoterCount },
      });
      if (result.count === 1) {
        await recordAudit(
          {
            actorId: session.user.id,
            action: 'RESOLUTION_CLOSED',
            targetId: parsed.data.id,
            targetLabel: await resolutionAuditLabel(parsed.data.id, tx),
          },
          tx,
        );
      }
      return result;
    });
    if (updated.count !== 1) {
      const exists = await prisma.resolution.count({ where: { id: parsed.data.id } });
      return { ok: false, error: exists ? 'locked' : 'not_found' };
    }
  } catch (error) {
    console.error('[resolutions] close failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateResolutions();
  return { ok: true };
}

/** Only drafts can be deleted; opened resolutions are part of the record. */
export async function deleteResolutionAction(input: unknown): Promise<ResolutionActionResult> {
  const session = await getSessionWithRole(RESOLUTION_EDITORS);
  if (!session) return { ok: false, error: 'forbidden' };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const deleted = await prisma.$transaction(async (tx) => {
    const targetLabel = await resolutionAuditLabel(parsed.data.id, tx);
    const result = await tx.resolution.deleteMany({ where: { id: parsed.data.id, status: 'DRAFT' } });
    if (result.count === 1) {
      await recordAudit(
        { actorId: session.user.id, action: 'RESOLUTION_DELETED', targetId: parsed.data.id, targetLabel },
        tx,
      );
    }
    return result;
  });
  if (deleted.count !== 1) {
    const exists = await prisma.resolution.count({ where: { id: parsed.data.id } });
    return { ok: false, error: exists ? 'locked' : 'not_found' };
  }

  revalidateResolutions();
  return { ok: true };
}

// ── Voting ────────────────────────────────────────────────────────────────────

/**
 * One final vote. Integrity is enforced by the database, inside one transaction:
 * UNIQUE(userId, resolutionId) → second vote rejected; composite FK → option must belong
 * to the resolution; BEFORE INSERT trigger locks the resolution row (FOR SHARE) and
 * rejects anything not ACTIVE or past its deadline, so a concurrent close cannot slip
 * a late ballot in. The UPDATE/DELETE trigger makes the stored vote immutable.
 */
export async function castVoteAction(input: unknown): Promise<VoteResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const parsed = voteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { resolutionId, optionId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vote.create({
        data: { userId: session.user.id, resolutionId, voteOptionId: optionId },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { ok: false, error: 'already_voted' };
      if (error.code === 'P2003') return { ok: false, error: 'invalid_option' };
    }
    if (databaseRejection(error) === 'closed') return { ok: false, error: 'closed' };
    console.error('[resolutions] vote failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateResolutions();
  return { ok: true };
}
