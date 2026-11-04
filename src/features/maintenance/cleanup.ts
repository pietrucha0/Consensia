import 'server-only';

import { prepareResolutionEmails } from '@/features/resolutions/notifications';
import { closeExpiredResolutions } from '@/features/resolutions/queries';
import { prisma } from '@/lib/prisma';
import { RATE_LIMIT_MAX_WINDOW_MS } from '@/lib/rate-limit';
import { deleteUpload, listUploads } from '@/lib/storage';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sign-ups nobody confirmed within this time are removed (their link expired long ago). */
const UNVERIFIED_ACCOUNT_TTL_MS = 7 * DAY_MS;
/** Uploads get this long to be attached to a saved article/resolution before counting as orphans. */
const ORPHAN_UPLOAD_GRACE_MS = DAY_MS;
/** Members who have not voted are reminded once, when less than this is left before the deadline. */
const REMINDER_LEAD_MS = DAY_MS;

export type MaintenanceReport = {
  remindersSent: number;
  expiredSessions: number;
  expiredVerificationTokens: number;
  expiredResetTokens: number;
  expiredEmailChanges: number;
  staleRateLimits: number;
  abandonedSignUps: number;
  orphanUploads: number;
};

/**
 * Housekeeping, safe to run at any time and as often as wanted (every step is idempotent).
 * Triggered by the scheduler through /api/cron/maintenance.
 */
export async function runMaintenance(now = new Date()): Promise<MaintenanceReport> {
  // Records the outcome of resolutions whose deadline passed while nobody was looking.
  await closeExpiredResolutions();

  const [sessions, verificationTokens, resetTokens, emailChanges, rateLimits] = await Promise.all([
    prisma.session.deleteMany({ where: { expires: { lt: now } } }),
    prisma.verificationToken.deleteMany({ where: { expires: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expires: { lt: now } } }),
    prisma.emailChangeRequest.deleteMany({ where: { expires: { lt: now } } }),
    prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - RATE_LIMIT_MAX_WINDOW_MS) } } }),
  ]);

  return {
    remindersSent: await sendDeadlineReminders(now),
    expiredSessions: sessions.count,
    expiredVerificationTokens: verificationTokens.count,
    expiredResetTokens: resetTokens.count,
    expiredEmailChanges: emailChanges.count,
    staleRateLimits: rateLimits.count,
    abandonedSignUps: await deleteAbandonedSignUps(now),
    orphanUploads: await deleteOrphanUploads(now),
  };
}

/**
 * "Voting ends tomorrow" email for open resolutions with a deadline less than a day away.
 * The resolution is claimed first (reminderSentAt set only if still empty), so overlapping
 * runs or several app instances never send the same reminder twice.
 */
async function sendDeadlineReminders(now: Date): Promise<number> {
  const due = await prisma.resolution.findMany({
    where: {
      status: 'ACTIVE',
      reminderSentAt: null,
      closesAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      // Opened less than a lead time ago: the "voting is open" email is still fresh.
      openedAt: { lte: new Date(now.getTime() - REMINDER_LEAD_MS / 2) },
    },
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of due) {
    const claimed = await prisma.resolution.updateMany({
      where: { id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1) continue;
    const send = await prepareResolutionEmails(id, 'reminder');
    await send();
    sent += 1;
  }
  return sent;
}

/**
 * Never-confirmed accounts older than a week with no pending link. They cannot have
 * voted or written anything (sign-in requires a confirmed email), so nothing is lost.
 * Accounts an administrator disabled are kept as a record of that decision.
 */
async function deleteAbandonedSignUps(now: Date): Promise<number> {
  const candidates = await prisma.user.findMany({
    where: {
      emailVerified: null,
      disabledAt: null,
      createdAt: { lt: new Date(now.getTime() - UNVERIFIED_ACCOUNT_TTL_MS) },
    },
    select: { id: true, email: true },
    take: 500,
  });
  if (candidates.length === 0) return 0;

  const pending = await prisma.verificationToken.findMany({
    where: { identifier: { in: candidates.map((c) => c.email) }, expires: { gte: now } },
    select: { identifier: true },
  });
  const stillPending = new Set(pending.map((p) => p.identifier));
  const ids = candidates.filter((c) => !stillPending.has(c.email)).map((c) => c.id);

  const deleted = await prisma.user.deleteMany({
    where: {
      id: { in: ids },
      emailVerified: null,
      votes: { none: {} },
      articles: { none: {} },
      resolutionsCreated: { none: {} },
    },
  });
  return deleted.count;
}

/** Files no article or resolution points at (e.g. uploaded, then the form was abandoned). */
async function deleteOrphanUploads(now: Date): Promise<number> {
  const uploads = await listUploads();
  const old = uploads.filter((u) => u.modifiedAt.getTime() < now.getTime() - ORPHAN_UPLOAD_GRACE_MS);
  if (old.length === 0) return 0;

  const urls = old.map((u) => u.url);
  const [articles, resolutions] = await Promise.all([
    prisma.article.findMany({ where: { heroImageUrl: { in: urls } }, select: { heroImageUrl: true } }),
    prisma.resolution.findMany({
      where: { OR: [{ imageUrl: { in: urls } }, { attachmentUrl: { in: urls } }] },
      select: { imageUrl: true, attachmentUrl: true },
    }),
  ]);
  const referenced = new Set<string | null>([
    ...articles.map((a) => a.heroImageUrl),
    ...resolutions.flatMap((r) => [r.imageUrl, r.attachmentUrl]),
  ]);

  let removed = 0;
  for (const url of urls) {
    if (referenced.has(url)) continue;
    // Also keep files linked from inside article bodies or resolution descriptions.
    const [inBodies] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT (
        (SELECT count(*) FROM "article_translations" WHERE "body"::text LIKE ${`%${url}%`}) +
        (SELECT count(*) FROM "resolution_translations" WHERE "description" LIKE ${`%${url}%`})
      ) AS n`;
    if (inBodies && inBodies.n > BigInt(0)) continue;
    await deleteUpload(url);
    removed += 1;
  }
  return removed;
}
