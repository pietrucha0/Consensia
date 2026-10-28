import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'pl', 'es', 'fr'],
  defaultLocale: 'en',
  // Every page URL carries its locale. The proxy never has to reason about an
  // implicit locale, and next-intl never *rewrites* an unprefixed URL into content.
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (routing.locales as readonly string[]).includes(value);
}
