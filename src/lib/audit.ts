import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import type { AuditAction } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

type AuditEntry = {
  /** null = the system (e.g. a deadline passed). */
  actorId: string | null;
  action: AuditAction;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Prisma.InputJsonObject;
};

type Db = Pick<typeof prisma, 'auditLog'> | Prisma.TransactionClient;

/**
 * Appends to the audit log. Pass the transaction client when the change itself runs in a
 * transaction, so the entry commits (or rolls back) together with it.
 */
export async function recordAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel?.slice(0, 300) ?? null,
      ...(entry.metadata && { metadata: entry.metadata }),
    },
  });
}
