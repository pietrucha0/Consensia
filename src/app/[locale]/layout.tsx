import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { isLocale, routing } from '@/i18n/routing';

import '../globals.css';

// latin-ext covers Polish (ą ę ł ż …) and French/Spanish diacritics.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: { default: 'Consensia', template: '%s · Consensia' },
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

/** Namespaces client components may use on public (auth) pages. */
const PUBLIC_NAMESPACES = ['common', 'locales', 'validation', 'auth', 'errors'] as const;

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // Guests only receive public UI strings; the (dashboard) layout adds the rest after auth.
  const messages = await getMessages();
  const publicMessages = Object.fromEntries(PUBLIC_NAMESPACES.map((ns) => [ns, messages[ns]]));

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider messages={publicMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
