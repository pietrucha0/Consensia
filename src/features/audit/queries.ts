import 'server-only';

import { z } from 'zod';

import { AuditAction } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_CATEGORIES = ['all', 'users', 'articles', 'resolutions'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

const ACTIONS_BY_CATEGORY: Record<Exclude<AuditCategory, 'all'>, AuditAction[]> = {
  users: [AuditAction.USER_ROLE_CHANGED, AuditAction.USER_DISABLED, AuditAction.USER_ENABLED, AuditAction.PASSWORD_CHANGED],
  articles: [
    AuditAction.ARTICLE_CREATED,
    AuditAction.ARTICLE_UPDATED,
    AuditAction.ARTICLE_PUBLISHED,
    AuditAction.ARTICLE_DELETED,
  ],
  resolutions: [
    AuditAction.RESOLUTION_CREATED,
    AuditAction.RESOLUTION_UPDATED,
    AuditAction.RESOLUTION_OPENED,
    AuditAction.RESOLUTION_CLOSED,
    AuditAction.RESOLUTION_DELETED,
  ],
};

export const auditFiltersSchema = z.object({
  category: z.enum(AUDIT_CATEGORIES).catch('all'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type AuditFilters = z.output<typeof auditFiltersSchema>;

/** Callers must have checked `requireRole(['ADMIN'])`. */
export async function listAuditLog(filters: AuditFilters) {
  const where = filters.category === 'all' ? {} : { action: { in: ACTIONS_BY_CATEGORY[filters.category] } };
  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetLabel: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);
  return { entries, total, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/** Reads the `{ from, to }` / `{ reason }` details written by recordAudit(). */
export function auditDetails(metadata: unknown): { from?: string; to?: string; reason?: string } {
  const parsed = z
    .object({ from: z.string().optional(), to: z.string().optional(), reason: z.string().optional() })
    .safeParse(metadata);
  return parsed.success ? parsed.data : {};
}
