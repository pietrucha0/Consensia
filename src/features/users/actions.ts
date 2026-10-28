'use server';

import { revalidatePath } from 'next/cache';

import { recordAudit } from '@/lib/audit';
import { getSessionWithRole } from '@/lib/dal';
import { prisma } from '@/lib/prisma';

import { changeRoleInputSchema, setDisabledInputSchema } from './schemas';

export type UserActionError = 'forbidden' | 'validation' | 'not_found' | 'self' | 'last_admin' | 'generic';
export type UserActionResult = { ok: true } | { ok: false; error: UserActionError };

const USER_ADMINS = ['ADMIN'] as const;

/** Raised by the `users_keep_one_active_admin` trigger (see the audit-log migration). */
function isLastAdminRejection(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('last active administrator');
}

function revalidateMembers(): void {
  revalidatePath('/[locale]/admin/users', 'page');
}

/**
 * Role changes apply on the member's next request: sessions live in the database and
 * the role is read from the user row each time, so nothing has to be revoked.
 */
export async function changeUserRoleAction(input: unknown): Promise<UserActionResult> {
  const session = await getSessionWithRole(USER_ADMINS);
  if (!session) return { ok: false, error: 'forbidden' };

  const parsed = changeRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { userId, role } = parsed.data;
  // Admins cannot demote themselves by accident; another admin has to do it.
  if (userId === session.user.id) return { ok: false, error: 'self' };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
      if (!target) return 'not_found' as const;
      if (target.role === role) return 'ok' as const;

      await tx.user.update({ where: { id: userId }, data: { role } });
      await recordAudit(
        {
          actorId: session.user.id,
          action: 'USER_ROLE_CHANGED',
          targetId: userId,
          targetLabel: target.email,
          metadata: { from: target.role, to: role },
        },
        tx,
      );
      return 'ok' as const;
    });
    if (outcome !== 'ok') return { ok: false, error: outcome };
  } catch (error) {
    if (isLastAdminRejection(error)) return { ok: false, error: 'last_admin' };
    console.error('[users] role change failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateMembers();
  return { ok: true };
}

/**
 * Disabling signs the member out everywhere at once (their session rows are deleted)
 * and blocks sign-in. Past votes stay on record; the member simply stops counting
 * towards turnout of resolutions that close from now on.
 */
export async function setUserDisabledAction(input: unknown): Promise<UserActionResult> {
  const session = await getSessionWithRole(USER_ADMINS);
  if (!session) return { ok: false, error: 'forbidden' };

  const parsed = setDisabledInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { userId, disabled } = parsed.data;
  if (userId === session.user.id) return { ok: false, error: 'self' };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true, email: true } });
      if (!target) return 'not_found' as const;
      if ((target.disabledAt !== null) === disabled) return 'ok' as const;

      await tx.user.update({
        where: { id: userId },
        data: disabled ? { disabledAt: new Date() } : { disabledAt: null, failedLoginCount: 0, lockedUntil: null },
      });
      if (disabled) {
        await tx.session.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { email: target.email } });
      }
      await recordAudit(
        {
          actorId: session.user.id,
          action: disabled ? 'USER_DISABLED' : 'USER_ENABLED',
          targetId: userId,
          targetLabel: target.email,
        },
        tx,
      );
      return 'ok' as const;
    });
    if (outcome !== 'ok') return { ok: false, error: outcome };
  } catch (error) {
    if (isLastAdminRejection(error)) return { ok: false, error: 'last_admin' };
    console.error('[users] disable/enable failed', error);
    return { ok: false, error: 'generic' };
  }

  revalidateMembers();
  return { ok: true };
}
