'use server';

import { AuthError, CredentialsSignin } from 'next-auth';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { signIn, signOut } from '@/auth';
import { Prisma } from '@/generated/prisma/client';
import type { Locale } from '@/i18n/routing';
import { safeCallbackUrl } from '@/lib/auth/callback-url';
import { hashPassword } from '@/lib/auth/password';
import { SIGN_IN_PATH } from '@/lib/auth/routes';
import {
  EMAIL_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  generateToken,
  hashToken,
} from '@/lib/auth/tokens';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, type RateLimitBucket } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request-ip';

import { findPendingSignUp } from './credentials';
import { prepareActionEmail } from './emails';
import type { ActionResult, SignInErrorCode } from './errors';
import {
  forgotPasswordActionSchema,
  resendVerificationActionSchema,
  resetPasswordActionSchema,
  signInActionSchema,
  signUpActionSchema,
  verifyEmailActionSchema,
} from './schemas';

/**
 * All actions re-validate their input with the same Zod schemas as the forms.
 * Actions that could reveal whether an address is registered (sign-up, forgot password,
 * resend) always answer `{ ok: true }` and send email in `after()`, so neither the
 * response nor its timing depends on the account's existence.
 */

async function ipOverLimit(bucket: RateLimitBucket): Promise<boolean> {
  return !(await consumeRateLimit(bucket, await getClientIp()));
}

// ── Sign in / out ─────────────────────────────────────────────────────────────

export async function signInAction(input: unknown): Promise<ActionResult> {
  const parsed = signInActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { email, password, locale, callbackUrl } = parsed.data;

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { ok: false, error: toSignInErrorCode(error.code) };
    }
    if (error instanceof AuthError) {
      console.error('[auth] sign-in failed', error);
      return { ok: false, error: 'generic' };
    }
    throw error;
  }

  redirect(safeCallbackUrl(callbackUrl, locale));
}

function toSignInErrorCode(code: string): SignInErrorCode {
  switch (code) {
    case 'email_not_verified':
    case 'account_locked':
    case 'account_disabled':
    case 'rate_limited':
      return code;
    default:
      return 'invalid_credentials';
  }
}

export async function signOutAction(locale: Locale): Promise<void> {
  // Database strategy: deletes the Session row, then clears the cookie.
  await signOut({ redirect: false });
  redirect(`/${locale}${SIGN_IN_PATH}`);
}

// ── Sign up & email verification ─────────────────────────────────────────────

export async function signUpAction(input: unknown): Promise<ActionResult> {
  const parsed = signUpActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { name, email, password, locale } = parsed.data;
  if (await ipOverLimit('signUp')) return { ok: false, error: 'rate_limited' };

  // Hash unconditionally so every branch costs the same.
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true, disabledAt: true },
  });
  // Registered address: answer exactly as for a new one.
  if (existing?.emailVerified || existing?.disabledAt) return { ok: true };

  if (!existing) {
    try {
      // No password yet — it is attached to the verification token below.
      await prisma.user.create({ data: { email, name, preferredLocale: locale } });
    } catch (error) {
      // Concurrent sign-up for the same address: the row exists now, carry on.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  if (await verificationEmailOnCooldown(email)) return { ok: true };

  await issueVerificationToken({ email, name, passwordHash, locale });
  return { ok: true };
}

/** From the sign-in page after `email_not_verified`: re-sends the link for the matching sign-up. */
export async function resendVerificationAction(input: unknown): Promise<ActionResult> {
  const parsed = resendVerificationActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { email, password, locale } = parsed.data;
  if (await ipOverLimit('emailRequest')) return { ok: false, error: 'rate_limited' };

  const pending = await findPendingSignUp(email, password);
  if (!pending || (await verificationEmailOnCooldown(email))) return { ok: true };

  const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
  if (!user || user.emailVerified) return { ok: true };

  await issueVerificationToken({ email, name: pending.name, passwordHash: pending.passwordHash, locale });
  return { ok: true };
}

export async function verifyEmailAction(input: unknown): Promise<ActionResult> {
  const parsed = verifyEmailActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_token' };
  const { token, locale } = parsed.data;
  if (await ipOverLimit('tokenCheck')) return { ok: false, error: 'rate_limited' };

  const tokenHash = hashToken(token);
  const now = new Date();

  const verified = await prisma.$transaction(async (tx) => {
    const record = await tx.verificationToken.findUnique({ where: { token: tokenHash } });
    if (!record || record.expires <= now) return false;

    // Atomic claim: of two concurrent clicks, exactly one deletes the row.
    const claimed = await tx.verificationToken.deleteMany({ where: { token: tokenHash } });
    if (claimed.count !== 1) return false;

    const user = await tx.user.findUnique({
      where: { email: record.identifier },
      select: { id: true, emailVerified: true },
    });
    if (!user) return false;

    // Already verified: a stale link must never replace the active password.
    if (!user.emailVerified) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: now,
          ...(record.passwordHash && { passwordHash: record.passwordHash }),
          ...(record.name && { name: record.name }),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    }
    // Every other pending sign-up for this address is now void.
    await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
    return true;
  });

  if (!verified) return { ok: false, error: 'invalid_token' };
  redirect(`/${locale}${SIGN_IN_PATH}?verified=1`);
}

async function verificationEmailOnCooldown(email: string): Promise<boolean> {
  const latest = await prisma.verificationToken.findFirst({
    where: { identifier: email },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return latest !== null && Date.now() - latest.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS;
}

async function issueVerificationToken(params: {
  email: string;
  name: string | null;
  passwordHash: string;
  locale: Locale;
}): Promise<void> {
  const { email, name, passwordHash, locale } = params;
  const { raw, hash } = generateToken();

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hash,
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      passwordHash,
      name,
    },
  });

  after(await prepareActionEmail({ kind: 'verify', to: email, name, token: raw, locale }));
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { email, locale } = parsed.data;
  if (await ipOverLimit('emailRequest')) return { ok: false, error: 'rate_limited' };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return { ok: true };

  const latest = await prisma.passwordResetToken.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS) return { ok: true };

  const { raw, hash } = generateToken();
  // Only the newest link works.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, token: hash, expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    }),
  ]);

  after(await prepareActionEmail({ kind: 'reset', to: email, name: user.name, token: raw, locale }));
  return { ok: true };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordActionSchema.safeParse(input);
  if (!parsed.success) {
    const tokenInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'token');
    return { ok: false, error: tokenInvalid ? 'invalid_token' : 'validation' };
  }
  const { token, password, locale } = parsed.data;
  if (await ipOverLimit('tokenCheck')) return { ok: false, error: 'rate_limited' };

  const tokenHash = hashToken(token);
  const now = new Date();

  // Cheap pre-check so an invalid link does not cost an argon2 hash.
  const record = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
  if (!record || record.expires <= now) return { ok: false, error: 'invalid_token' };

  const passwordHash = await hashPassword(password);

  const changed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.deleteMany({
      where: { token: tokenHash, expires: { gt: now } },
    });
    if (claimed.count !== 1) return false;

    const user = await tx.user.findUnique({
      where: { email: record.email },
      select: { id: true, emailVerified: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return false;

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        // The reset link proved control of the mailbox.
        emailVerified: user.emailVerified ?? now,
      },
    });
    await tx.passwordResetToken.deleteMany({ where: { email: record.email } });
    // Pending sign-ups would otherwise be able to swap the password back.
    await tx.verificationToken.deleteMany({ where: { identifier: record.email } });
    // Sign out everywhere.
    await tx.session.deleteMany({ where: { userId: user.id } });
    return true;
  });

  if (!changed) return { ok: false, error: 'invalid_token' };
  redirect(`/${locale}${SIGN_IN_PATH}?reset=1`);
}
