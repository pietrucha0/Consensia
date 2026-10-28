import 'server-only';

import { getTranslations } from 'next-intl/server';

import { ActionEmail } from '@/emails/action-email';
import { env } from '@/env';
import { routing, type Locale } from '@/i18n/routing';
import { pickTranslation } from '@/i18n/pick-translation';
import { sendEmailBatch, type Email } from '@/lib/email/send';
import { prisma } from '@/lib/prisma';

/**
 * "Voting is open" emails for every member who can vote and has not opted out.
 * Rendering needs the request scope (translations), so this prepares everything now and
 * returns the sender for `after()` — opening a resolution never waits on the mail provider.
 */
export async function prepareResolutionOpenedEmails(resolutionId: string): Promise<() => Promise<void>> {
  const [resolution, recipients] = await Promise.all([
    prisma.resolution.findUnique({
      where: { id: resolutionId },
      select: { reference: true, closesAt: true, translations: { select: { locale: true, title: true } } },
    }),
    prisma.user.findMany({
      where: { emailVerified: { not: null }, disabledAt: null, notifyNewResolutions: true },
      select: { email: true, name: true, preferredLocale: true },
    }),
  ]);
  if (!resolution || recipients.length === 0) return async () => {};

  const byLocale = new Map<Locale, Awaited<ReturnType<typeof localeStrings>>>();
  for (const locale of routing.locales) {
    if (recipients.some((r) => r.preferredLocale === locale)) {
      byLocale.set(locale, await localeStrings(locale, resolutionId, resolution));
    }
  }

  const emails: Email[] = [];
  for (const recipient of recipients) {
    const strings = byLocale.get(recipient.preferredLocale);
    if (!strings) continue;
    const greeting = strings.greeting(recipient.name ?? recipient.email);
    emails.push({
      to: recipient.email,
      subject: strings.subject,
      react: (
        <ActionEmail
          lang={recipient.preferredLocale}
          preview={strings.preview}
          heading={strings.heading}
          greeting={greeting}
          body={strings.body}
          buttonLabel={strings.button}
          url={strings.url}
          expires={strings.deadline}
          ignore={strings.reason}
          linkFallback={strings.linkFallback}
          footer={strings.footer}
        />
      ),
      text: [greeting, '', strings.body, '', strings.url, '', strings.deadline, strings.reason].join('\n'),
    });
  }

  return async () => {
    try {
      await sendEmailBatch(emails);
    } catch (error) {
      console.error(`[email] resolution ${resolutionId} announcement failed`, error);
    }
  };
}

async function localeStrings(
  locale: Locale,
  resolutionId: string,
  resolution: { reference: string | null; closesAt: Date | null; translations: { locale: Locale; title: string }[] },
) {
  const t = await getTranslations({ locale, namespace: 'emails' });
  const title = pickTranslation(resolution.translations, locale)?.title ?? '';
  const fullTitle = resolution.reference ? `${resolution.reference} · ${title}` : title;
  const deadline = resolution.closesAt
    ? t('resolutionOpened.deadline', {
        date: new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: env.APP_TIME_ZONE,
        }).format(resolution.closesAt),
      })
    : t('resolutionOpened.noDeadline');

  return {
    subject: t('resolutionOpened.subject', { title: fullTitle }),
    preview: t('resolutionOpened.preview', { title: fullTitle }),
    heading: t('resolutionOpened.heading'),
    body: t('resolutionOpened.body', { title: fullTitle }),
    button: t('resolutionOpened.button'),
    reason: t('resolutionOpened.reason'),
    deadline,
    url: `${env.APP_URL}/${locale}/resolutions/${resolutionId}`,
    linkFallback: t('linkFallback'),
    footer: t('footer'),
    greeting: (name: string) => t('greeting', { name }),
  };
}
