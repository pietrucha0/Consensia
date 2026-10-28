import { routing, type Locale } from '@/i18n/routing';

/**
 * Picks the translation to show: the reader's locale → the default locale (en) →
 * the first available one in routing order.
 */
export function pickTranslation<T extends { locale: Locale }>(translations: readonly T[], locale: Locale): T | undefined {
  const order = [locale, routing.defaultLocale, ...routing.locales];
  for (const candidate of order) {
    const match = translations.find((t) => t.locale === candidate);
    if (match) return match;
  }
  return undefined;
}
