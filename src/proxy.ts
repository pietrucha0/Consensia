import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

import { isLocale, routing, type Locale } from '@/i18n/routing';
import { PUBLIC_API_PREFIXES, PUBLIC_PATHS, SIGN_IN_PATH } from '@/lib/auth/routes';

/**
 * Walled-garden gate (Next.js 16 `proxy.ts`, formerly `middleware.ts`).
 *
 * Layer 1 of 2 — an OPTIMISTIC check: "is there a session cookie?". It is cheap,
 * needs no DB and no Node APIs, so it runs identically on the Node and Edge runtimes.
 *
 * Layer 2 — the AUTHORITATIVE check — is `verifySession()` in `src/lib/dal.ts`,
 * which validates the session against the database and is called by every page,
 * data query and Server Action. A forged or expired cookie can get past this file,
 * but it cannot render or mutate anything.
 *
 * Default-deny: any path not explicitly whitelisted in `PUBLIC_PATHS` needs a session,
 * including unknown locales, malformed paths and paths that would 404.
 */

const handleI18nRouting = createIntlMiddleware(routing);

/** Auth.js v5 session cookie; `__Secure-` on HTTPS, `.N` suffix when a JWT is chunked. */
const SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some(({ name, value }) => SESSION_COOKIE.test(name) && value !== '');
}

/** "/pl/auth/signin/" → { locale: "pl", path: "/auth/signin" };  "/" → { locale: null, path: "/" } */
function parsePath(pathname: string): { locale: Locale | null; path: string } {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  const locale = isLocale(first) ? first : null;
  const rest = locale ? segments.slice(1) : segments;
  return { locale, path: `/${rest.join('/')}` };
}

/**
 * Strict CSP: scripts only with this request's nonce ('strict-dynamic' lets Next's own
 * bundles load their chunks). Next.js reads the nonce from the request header below and
 * stamps it on every script it renders — pages are all dynamically rendered (they read
 * the session), so each response carries a fresh nonce.
 *
 * Styles allow 'unsafe-inline': React and Radix write style ATTRIBUTES (result bar widths,
 * popover positions), which a nonce cannot cover. Script injection is what CSP stops here.
 * Images may be any https URL because an article's hero image can be linked externally.
 */
function contentSecurityPolicy(nonce: string, secure: boolean): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only over HTTPS: on plain-HTTP hosts (local production runs) it would break every asset.
    ...(secure ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function proxy(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  const authenticated = hasSessionCookie(req);

  // API routes: no locale handling; JSON 401 instead of an HTML redirect.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (authenticated || isPublicApi(pathname)) return NextResponse.next();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale, path } = parsePath(pathname);

  if (!authenticated && !PUBLIC_PATHS.has(path)) {
    const url = req.nextUrl.clone();
    // Unprefixed request (e.g. "/"): redirect to the unprefixed sign-in URL, which is
    // public, and let next-intl negotiate the locale (cookie → Accept-Language → default).
    url.pathname = locale ? `/${locale}${SIGN_IN_PATH}` : SIGN_IN_PATH;
    url.search = '';
    // Same-origin by construction. The sign-in page must still re-validate it (open-redirect guard).
    if (path !== '/') url.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // NOTE: signed-in users visiting /auth/* are NOT bounced here. With an optimistic check a
  // stale cookie would loop (signin → home → DAL rejects → signin → …). The (auth) layout
  // does that redirect after a real `auth()` call instead.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const secure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  const csp = contentSecurityPolicy(nonce, secure);
  const headers = new Headers(req.headers);
  headers.set('content-security-policy', csp);
  // next-intl forwards the request headers it is given to the render.
  const response = handleI18nRouting(new NextRequest(req, { headers }));
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Everything except Next internals and files served from /public by extension.
  // /api is deliberately INCLUDED so non-auth API routes are gated too.
  matcher: [
    '/((?!_next/static|_next/image|_vercel|favicon\\.ico|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|txt|xml|webmanifest)$).*)',
  ],
};
