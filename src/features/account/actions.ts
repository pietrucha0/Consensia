'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/generated/prisma/client';
import { prepareActionEmail } from '@/features/auth/emails';
import { routing } from '@/i18n/routing';
import { recordAudit } from '@/lib/audit';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { EMAIL_VERIFICATION_TTL_MS, generateToken, hashToken } from '@/lib/auth/tokens';
import { getSession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';

import { prepareEmailChangedNotice } from './emails';
import { changeEmailSchema, changePasswordSchema, profileSchema } from './schemas';

export type AccountActionError =
  | 'unauthorized'
  | 'validation'
  | 'wrong_password'
  | 'rate_limited'
  | 'same_email'
  | 'email_taken'
  | 'invalid_token'
  | 'generic';
export type AccountActionResult = { ok: true } | { ok: false; error: AccountActionError };

/** Auth.js cookie names (secure prefix on HTTPS). */
const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'] as const;

/** The session token of THIS browser, so "sign out elsewhere" can keep it. */
async function currentSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}

export async function updateProfileAction(input: unknown): Promise<AccountActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  await prisma.user.update({ where: { id: session.user.id }, data: parsed.data });
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}

/**
 * Requires the current password (a borrowed unlocked laptop must not be enough),
 * then signs every OTHER device out.
 */
export async function changePasswordAction(input: unknown): Promise<AccountActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };
  if (!(await consumeRateLimit('passwordChange', session.user.id))) return { ok: false, error: 'rate_limited' };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    return { ok: false, error: 'wrong_password' };
  }

  const passwordHash = await hashPassword(newPassword);
  const keep = await currentSessionToken();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.session.deleteMany({
      where: { userId: session.user.id, ...(keep && { sessionToken: { not: keep } }) },
    });
    // A pending reset link must not be able to undo this change.
    await tx.passwordResetToken.deleteMany({ where: { email: user.email } });
    await recordAudit(
      { actorId: session.user.id, action: 'PASSWORD_CHANGED', targetId: session.user.id, targetLabel: user.email },
      tx,
    );
  });

  return { ok: true };
}

export async function signOutOtherSessionsAction(): Promise<AccountActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const keep = await currentSessionToken();
  if (!keep) return { ok: false, error: 'generic' };

  await prisma.session.deleteMany({ where: { userId: session.user.id, sessionToken: { not: keep } } });
  revalidatePath('/[locale]/account', 'page');
  return { ok: true };
}

// ── Email change ──────────────────────────────────────────────────────────────

/**
 * Step 1: password re-check, then a confirmation link to the NEW address. The address on
 * the account only changes once that link is used (step 2), so a typo cannot lock anyone out.
 */
export async function requestEmailChangeAction(input: unknown): Promise<AccountActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };
  if (!(await consumeRateLimit('emailRequest', session.user.id))) return { ok: false, error: 'rate_limited' };

  const parsed = changeEmailSchema.and(z.object({ locale: z.enum(routing.locales) })).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { newEmail, currentPassword, locale } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, passwordHash: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    return { ok: false, error: 'wrong_password' };
  }
  if (newEmail === user.email) return { ok: false, error: 'same_email' };
  // Members are signed in and re-entered their password: telling them the address is
  // in use is more useful than a link that could never work.
  if (await prisma.user.count({ where: { email: newEmail } })) return { ok: false, error: 'email_taken' };

  const { raw, hash } = generateToken();
  await prisma.$transaction([
    prisma.emailChangeRequest.deleteMany({ where: { userId: session.user.id } }),
    prisma.emailChangeRequest.create({
      data: {
        userId: session.user.id,
        newEmail,
        token: hash,
        expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    }),
  ]);

  after(await prepareActionEmail({ kind: 'emailChange', to: newEmail, name: user.name, token: raw, locale }));
  return { ok: true };
}

/**
 * Step 2, from the emailed link. Needs the session of the SAME account (the link alone is
 * not enough), and a POST — mail scanners that pre-open links cannot trigger it.
 */
export async function confirmEmailChangeAction(input: unknown): Promise<AccountActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const parsed = z
    .object({ token: z.string().min(20).max(200), locale: z.enum(routing.locales) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_token' };
  const { token, locale } = parsed.data;

  let change: { from: string; to: string; name: string | null } | null;
  try {
    change = await prisma.$transaction(async (tx) => {
      const request = await tx.emailChangeRequest.findUnique({ where: { token: hashToken(token) } });
      if (!request || request.userId !== session.user.id || request.expires <= new Date()) return null;

      const user = await tx.user.findUnique({ where: { id: request.userId }, select: { email: true, name: true } });
      if (!user) return null;

      await tx.user.update({ where: { id: request.userId }, data: { email: request.newEmail } });
      await tx.emailChangeRequest.deleteMany({ where: { userId: request.userId } });
      // Links issued for the old address must stop working.
      await tx.passwordResetToken.deleteMany({ where: { email: user.email } });
      await recordAudit(
        {
          actorId: session.user.id,
          action: 'EMAIL_CHANGED',
          targetId: request.userId,
          targetLabel: request.newEmail,
          metadata: { from: user.email, to: request.newEmail },
        },
        tx,
      );
      return { from: user.email, to: request.newEmail, name: user.name };
    });
  } catch (error) {
    // Someone registered the address after the request was made.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'email_taken' };
    }
    console.error('[account] email change failed', error);
    return { ok: false, error: 'generic' };
  }
  if (!change) return { ok: false, error: 'invalid_token' };

  // The old mailbox is told, so a hijacked session cannot quietly take the account over.
  after(await prepareEmailChangedNotice({ to: change.from, name: change.name, newEmail: change.to, locale }));
  revalidatePath('/[locale]', 'layout');
  redirect(`/${locale}/account?notice=emailChanged`);
}
