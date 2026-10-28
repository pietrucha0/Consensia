import 'server-only';

import { CredentialsSignin } from 'next-auth';

import { verifyAgainstDummy, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request-ip';

import type { SignInErrorCode } from './errors';
import { signInSchema } from './schemas';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
/** How many pending sign-ups for one address are checked when matching a password. */
const PENDING_LOOKBACK = 5;

/** Thrown from `authorize()`; Auth.js forwards `code` to the `signIn()` caller. */
export class SignInError extends CredentialsSignin {
  constructor(code: SignInErrorCode) {
    super();
    this.code = code;
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Credentials check used by Auth.js `authorize()`.
 *
 * Disclosure rules (anti-enumeration):
 * - unknown email and wrong password are indistinguishable (same message, same argon2 cost);
 * - "not verified" / "disabled" are only revealed to someone who knows the password;
 * - a locked account is refused WITHOUT checking the password, so guesses during the
 *   lockout window cannot confirm a correct password.
 *
 * Runs for the Server Action AND for direct POSTs to /api/auth/callback/credentials,
 * so the per-IP limit lives here rather than in the action.
 */
export async function authenticate(input: unknown): Promise<AuthenticatedUser> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) throw new SignInError('invalid_credentials');
  const { email, password } = parsed.data;

  if (!(await consumeRateLimit('signIn', await getClientIp()))) throw new SignInError('rate_limited');

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
      emailVerified: true,
      disabledAt: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    await verifyAgainstDummy(password);
    throw new SignInError('invalid_credentials');
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    await verifyAgainstDummy(password);
    throw new SignInError('account_locked');
  }

  // Unverified accounts have no active password yet — it waits on the verification token.
  if (!user.emailVerified || !user.passwordHash) {
    const matchesPendingSignUp = await findPendingSignUp(email, password);
    if (matchesPendingSignUp) throw new SignInError('email_not_verified');
    await registerFailedAttempt(user.id);
    throw new SignInError('invalid_credentials');
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await registerFailedAttempt(user.id);
    throw new SignInError('invalid_credentials');
  }

  if (user.disabledAt) throw new SignInError('account_disabled');

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

async function registerFailedAttempt(userId: string): Promise<void> {
  const { failedLoginCount } = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  if (failedLoginCount >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
    });
  }
}

export type PendingSignUp = { passwordHash: string; name: string | null; createdAt: Date };

/** Returns the most recent pending sign-up for `email` whose password matches, if any. */
export async function findPendingSignUp(email: string, password: string): Promise<PendingSignUp | null> {
  const pending = await prisma.verificationToken.findMany({
    where: { identifier: email, passwordHash: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: PENDING_LOOKBACK,
    select: { passwordHash: true, name: true, createdAt: true },
  });

  for (const entry of pending) {
    if (entry.passwordHash && (await verifyPassword(entry.passwordHash, password))) {
      return { passwordHash: entry.passwordHash, name: entry.name, createdAt: entry.createdAt };
    }
  }
  if (pending.length === 0) await verifyAgainstDummy(password);
  return null;
}
