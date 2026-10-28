import 'server-only';

import { getTranslations } from 'next-intl/server';

import { ActionEmail } from '@/emails/action-email';
import { env } from '@/env';
import type { Locale } from '@/i18n/routing';
import { sendEmail } from '@/lib/email/send';

type ActionEmailKind = 'verify' | 'reset' | 'emailChange';

const PATHS: Record<ActionEmailKind, string> = {
  verify: '/auth/verify-email',
  reset: '/auth/reset-password',
  emailChange: '/account/confirm-email',
};

/**
 * Renders a localized verification / reset email and returns a function that sends it.
 * Rendering happens inside the request (translations need it); the returned sender is
 * meant for `after()`, so the response time does not depend on whether an email is sent.
 */
export async function prepareActionEmail(params: {
  kind: ActionEmailKind;
  to: string;
  name: string | null;
  token: string;
  locale: Locale;
}): Promise<() => Promise<void>> {
  const { kind, to, name, token, locale } = params;
  const t = await getTranslations({ locale, namespace: 'emails' });

  const url = `${env.APP_URL}/${locale}${PATHS[kind]}?token=${encodeURIComponent(token)}`;
  const greeting = t('greeting', { name: name ?? to });
  const strings = {
    subject: t(`${kind}.subject`),
    preview: t(`${kind}.preview`),
    heading: t(`${kind}.heading`),
    body: t(`${kind}.body`),
    buttonLabel: t(`${kind}.button`),
    expires: t(`${kind}.expires`),
    ignore: t(`${kind}.ignore`),
  };

  const email = {
    to,
    subject: strings.subject,
    react: (
      <ActionEmail
        lang={locale}
        preview={strings.preview}
        heading={strings.heading}
        greeting={greeting}
        body={strings.body}
        buttonLabel={strings.buttonLabel}
        url={url}
        expires={strings.expires}
        ignore={strings.ignore}
        linkFallback={t('linkFallback')}
        footer={t('footer')}
      />
    ),
    text: [greeting, '', strings.body, '', url, '', strings.expires, strings.ignore].join('\n'),
  };

  return async () => {
    try {
      await sendEmail(email);
    } catch (error) {
      console.error(`[email] ${kind} email to ${to} failed`, error);
    }
  };
}
