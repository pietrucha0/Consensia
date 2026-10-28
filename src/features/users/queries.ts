import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import type { Role } from '@/generated/prisma/enums';
import { escapeLikePattern } from '@/lib/like-pattern';
import { prisma } from '@/lib/prisma';

import { USERS_PAGE_SIZE, type UserListFilters } from './schemas';

/** Callers must have checked `requireRole(['ADMIN'])`. */

export type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  verified: boolean;
  disabled: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
  voteCount: number;
};

function whereFor(filters: UserListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (filters.q) {
    const pattern = escapeLikePattern(filters.q);
    where.OR = [
      { email: { contains: pattern, mode: 'insensitive' } },
      { name: { contains: pattern, mode: 'insensitive' } },
    ];
  }
  if (filters.role) where.role = filters.role;
  switch (filters.status) {
    case 'active':
      where.emailVerified = { not: null };
      where.disabledAt = null;
      break;
    case 'unverified':
      where.emailVerified = null;
      where.disabledAt = null;
      break;
    case 'disabled':
      where.disabledAt = { not: null };
      break;
  }
  return where;
}

export async function listMembers(filters: UserListFilters) {
  const where = whereFor(filters);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        disabledAt: true,
        lockedUntil: true,
        createdAt: true,
        _count: { select: { votes: true } },
      },
    }),
  ]);

  const members: MemberRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: u.emailVerified !== null,
    disabled: u.disabledAt !== null,
    lockedUntil: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil : null,
    createdAt: u.createdAt,
    voteCount: u._count.votes,
  }));

  return { members, total, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

/** Headline numbers for the members page. */
export async function memberSummary(): Promise<{ eligible: number; unverified: number; disabled: number }> {
  const [eligible, unverified, disabled] = await Promise.all([
    prisma.user.count({ where: { emailVerified: { not: null }, disabledAt: null } }),
    prisma.user.count({ where: { emailVerified: null, disabledAt: null } }),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
  ]);
  return { eligible, unverified, disabled };
}
