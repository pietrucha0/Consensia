import { isLocale, type Locale } from '@/i18n/routing';

import { PUBLIC_PATHS } from './routes';

const BASE = 'http://consensia.invalid';

/**
 * Open-redirect guard for `?callbackUrl=`. Returns a same-origin, non-auth path
 * (pathname + search) or the locale home page.
 */
export function safeCallbackUrl(raw: string | null | undefined, locale: Locale): string {
  const fallback = `/${locale}`;
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  // Never bounce back into the auth flow.
  const segments = url.pathname.split('/').filter(Boolean);
  const withoutLocale = isLocale(segments[0]) ? segments.slice(1) : segments;
  if (PUBLIC_PATHS.has(`/${withoutLocale.join('/')}`)) return fallback;

  return `${url.pathname}${url.search}`;
}
