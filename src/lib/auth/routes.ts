/**
 * Single source of truth for the walled garden.
 * Paths are locale-less: "/auth/signin" matches "/en/auth/signin", "/pl/auth/signin", …
 * Everything NOT listed here requires a session.
 */

export const SIGN_IN_PATH = '/auth/signin';
export const DEFAULT_LOGIN_REDIRECT = '/';

export const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  '/auth/signin',
  '/auth/signup',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

/**
 * Reachable without a session cookie. Each must protect itself:
 * Auth.js endpoints (CSRF + credentials), webhooks (signatures), cron (shared secret),
 * health (reveals nothing but up/down).
 */
export const PUBLIC_API_PREFIXES: readonly string[] = ['/api/auth', '/api/webhooks', '/api/cron', '/api/health'];
