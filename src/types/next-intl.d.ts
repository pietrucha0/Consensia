import type messages from '../../messages/en.json';
import type { routing } from '@/i18n/routing';

// en.json is the source of truth: a missing or misspelled key is a type error.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
