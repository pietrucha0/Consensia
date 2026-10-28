import 'server-only';

import type { Session } from 'next-auth';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { auth } from '@/auth';
import type { Role } from '@/generated/prisma/enums';
import { redirect } from '@/i18n/navigation';
import { SIGN_IN_PATH } from '@/lib/auth/routes';

/**
 * Data Access Layer — the AUTHORITATIVE auth check (the proxy only looks for a cookie).
 * Call `verifySession()` / `requireRole()` in every page, data query and Server Action
 * that touches protected data. Layouts alone are not enough: they do not re-run on
 * client-side navigation.
 */

/** Validated session (DB lookup), memoized per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const session = await auth();
  return session?.user?.id ? session : null;
});

export async function verifySession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const locale = await getLocale();
    return redirect({ href: SIGN_IN_PATH, locale });
  }
  return session;
}

/** For Server Actions / route handlers: the session if it has one of `roles`, else null. */
export async function getSessionWithRole(roles: readonly Role[]): Promise<Session | null> {
  const session = await getSession();
  return session && roles.includes(session.user.role) ? session : null;
}

/** 404 rather than 403, so role-gated areas are not discoverable. */
export async function requireRole(roles: readonly Role[]): Promise<Session> {
  const session = await verifySession();
  if (!roles.includes(session.user.role)) notFound();
  return session;
}
