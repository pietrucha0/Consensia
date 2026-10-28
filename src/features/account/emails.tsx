import 'server-only';

import { getTranslations } from 'next-intl/server';

import { ActionEmail } from '@/emails/action-email';
import { env } from '@/env';
import type { Locale } from '@/i18n/routing';
import { sendEmail } from '@/lib/email/send';

/** Security notice to the PREVIOUS address after an email change. Returns a sender for `after()`. */
export async function prepareEmailChangedNotice(params: {
  to: string;
  name: string | null;
  newEmail: string;
  locale: Locale;
}): Promise<() => Promise<void>> {
  const { to, name, newEmail, locale } = params;
  const t = await getTranslations({ locale, namespace: 'emails' });

  const url = `${env.APP_URL}/${locale}/account`;
  const greeting = t('greeting', { name: name ?? to });
  const body = t('emailChanged.body', { email: newEmail });
  const warning = t('emailChanged.warning');

  const email = {
    to,
    subject: t('emailChanged.subject'),
    react: (
      <ActionEmail
        lang={locale}
        preview={t('emailChanged.subject')}
        heading={t('emailChanged.heading')}
        greeting={greeting}
        body={body}
        buttonLabel={t('emailChanged.button')}
        url={url}
        expires={warning}
        ignore=""
        linkFallback={t('linkFallback')}
        footer={t('footer')}
      />
    ),
    text: [greeting, '', body, '', warning, '', url].join('\n'),
  };

  return async () => {
    try {
      await sendEmail(email);
    } catch (error) {
      console.error(`[email] email-change notice to ${to} failed`, error);
    }
  };
}
