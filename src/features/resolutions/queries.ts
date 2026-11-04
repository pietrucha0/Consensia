import 'server-only';

import { env } from '@/env';
import type { Prisma } from '@/generated/prisma/client';
import type { ResolutionStatus } from '@/generated/prisma/enums';
import { pickTranslation } from '@/i18n/pick-translation';
import { routing, type Locale } from '@/i18n/routing';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { utcToZonedDateTimeInput } from '@/lib/time-zone';

import { tallyVotes, type ResolutionResults } from './tally';
import { emptyResolutionForm, type OptionLabels, type ResolutionFormValues } from './schemas';

/**
 * Callers handle authorization (verifySession / requireRole). Blind voting is enforced
 * HERE: results and turnout are only computed and returned when the viewer may see them,
 * so they never reach a browser that has not voted.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Every verified, non-disabled account may vote (members, moderators, admins). */
export function countEligibleVoters(): Promise<number> {
  return prisma.user.count({ where: { emailVerified: { not: null }, disabledAt: null } });
}

/**
 * ACTIVE resolutions whose deadline passed are closed lazily on read: the vote trigger
 * already refuses late ballots, this records the outcome (closedAt = the deadline) and
 * freezes turnout. Idempotent — `status: 'ACTIVE'` in the filter makes a race a no-op.
 */
export async function closeExpiredResolutions(): Promise<void> {
  const now = new Date();
  const expired = await prisma.resolution.findMany({
    where: { status: 'ACTIVE', closesAt: { lte: now } },
    select: { id: true, closesAt: true },
  });
  if (expired.length === 0) return;
  const eligible = await countEligibleVoters();
  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      const closed = await tx.resolution.updateMany({
        where: { id: r.id, status: 'ACTIVE' },
        data: { status: 'CLOSED', closedAt: r.closesAt ?? now, eligibleVoterCount: eligible },
      });
      if (closed.count === 1) {
        await recordAudit(
          {
            actorId: null,
            action: 'RESOLUTION_CLOSED',
            targetId: r.id,
            targetLabel: await resolutionAuditLabel(r.id, tx),
            metadata: { reason: 'deadline' },
          },
          tx,
        );
      }
    });
  }
}

/** "7/2026 · Title" snapshot for the audit log. */
export async function resolutionAuditLabel(id: string, db: Db = prisma): Promise<string | null> {
  const resolution = await db.resolution.findUnique({
    where: { id },
    select: { reference: true, translations: { select: { locale: true, title: true } } },
  });
  if (!resolution) return null;
  const title = pickTranslation(resolution.translations, routing.defaultLocale)?.title ?? '';
  return resolution.reference ? `${resolution.reference} · ${title}` : title;
}

// ── Member views ──────────────────────────────────────────────────────────────

/** Open resolutions (deadline not passed) the viewer has not voted on yet. */
export function countPendingVotes(viewerId: string): Promise<number> {
  return prisma.resolution.count({
    where: {
      status: 'ACTIVE',
      OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }],
      votes: { none: { userId: viewerId } },
    },
  });
}

export type ResolutionListItem = {
  id: string;
  reference: string | null;
  title: string;
  status: ResolutionStatus;
  openedAt: Date | null;
  closesAt: Date | null;
  closedAt: Date | null;
  viewerVoted: boolean;
  contentLocale: Locale;
};

/** Open and closed resolutions (drafts are only visible in the moderator panel). */
export async function listResolutions(locale: Locale, viewerId: string): Promise<ResolutionListItem[]> {
  await closeExpiredResolutions();
  const rows = await prisma.resolution.findMany({
    where: { status: { in: ['ACTIVE', 'CLOSED'] } },
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      reference: true,
      status: true,
      openedAt: true,
      closesAt: true,
      closedAt: true,
      translations: { select: { locale: true, title: true } },
      votes: { where: { userId: viewerId }, select: { id: true } },
    },
  });

  return rows.flatMap((row): ResolutionListItem[] => {
    const t = pickTranslation(row.translations, locale);
    if (!t) return [];
    return [
      {
        id: row.id,
        reference: row.reference,
        title: t.title,
        status: row.status,
        openedAt: row.openedAt,
        closesAt: row.closesAt,
        closedAt: row.closedAt,
        viewerVoted: row.votes.length > 0,
        contentLocale: t.locale,
      },
    ];
  });
}

export type { ResolutionResults } from './tally';

export type ResolutionDetail = {
  id: string;
  reference: string | null;
  status: ResolutionStatus;
  title: string;
  description: string;
  imageUrl: string | null;
  attachmentUrl: string | null;
  openedAt: Date | null;
  closesAt: Date | null;
  closedAt: Date | null;
  contentLocale: Locale;
  options: { id: string; label: string }[];
  viewerVote: { optionId: string; castAt: Date } | null;
  /** null = hidden (viewer has not voted and voting is still open). */
  results: ResolutionResults | null;
  canVote: boolean;
};

export async function getResolutionForMember(
  id: string,
  locale: Locale,
  viewerId: string,
  options: { includeDrafts?: boolean } = {},
): Promise<ResolutionDetail | null> {
  await closeExpiredResolutions();
  const row = await prisma.resolution.findFirst({
    where: { id, ...(!options.includeDrafts && { status: { in: ['ACTIVE', 'CLOSED'] } }) },
    select: {
      id: true,
      reference: true,
      status: true,
      imageUrl: true,
      attachmentUrl: true,
      openedAt: true,
      closesAt: true,
      closedAt: true,
      eligibleVoterCount: true,
      translations: { select: { locale: true, title: true, description: true } },
      options: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, translations: { select: { locale: true, label: true } } },
      },
      votes: { where: { userId: viewerId }, select: { voteOptionId: true, createdAt: true } },
    },
  });
  if (!row) return null;
  const t = pickTranslation(row.translations, locale);
  if (!t) return null;

  const own = row.votes[0];
  const viewerVote = own ? { optionId: own.voteOptionId, castAt: own.createdAt } : null;
  const resultsVisible = viewerVote !== null || row.status === 'CLOSED';

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    title: t.title,
    description: t.description,
    imageUrl: row.imageUrl,
    attachmentUrl: row.attachmentUrl,
    openedAt: row.openedAt,
    closesAt: row.closesAt,
    closedAt: row.closedAt,
    contentLocale: t.locale,
    options: row.options.map((o) => ({
      id: o.id,
      label: pickTranslation(o.translations, locale)?.label ?? `#${o.order + 1}`,
    })),
    viewerVote,
    results: resultsVisible ? await computeResults(row.id, row.options.map((o) => o.id), row.eligibleVoterCount) : null,
    canVote: row.status === 'ACTIVE' && viewerVote === null && (row.closesAt === null || row.closesAt > new Date()),
  };
}

async function computeResults(
  resolutionId: string,
  optionIds: string[],
  frozenEligible: number | null,
): Promise<ResolutionResults> {
  const [grouped, liveEligible] = await Promise.all([
    prisma.vote.groupBy({ by: ['voteOptionId'], where: { resolutionId }, _count: { _all: true } }),
    frozenEligible === null ? countEligibleVoters() : Promise.resolve(frozenEligible),
  ]);
  return tallyVotes({
    optionIds,
    counts: new Map(grouped.map((g) => [g.voteOptionId, g._count._all])),
    eligible: liveEligible,
    eligibleIsFinal: frozenEligible !== null,
  });
}

// ── Protocol (closed resolutions, for the board) ──────────────────────────────

export type ProtocolVote = { name: string | null; email: string; optionId: string; castAt: Date };

export type ResolutionProtocol = {
  id: string;
  reference: string | null;
  title: string;
  description: string;
  contentLocale: Locale;
  createdBy: string | null;
  openedAt: Date;
  closesAt: Date | null;
  closedAt: Date;
  options: { id: string; label: string }[];
  results: ResolutionResults;
  /** The ballot is open: every vote with its voter, in alphabetical order. */
  votes: ProtocolVote[];
};

/**
 * Record of a CLOSED resolution: wording, results, turnout and the named list of votes.
 * Only closed ones — while voting runs, a moderator who has not voted yet must not see
 * the tally. Callers check `requireRole(['ADMIN', 'MODERATOR'])`.
 */
export async function getResolutionProtocol(id: string, locale: Locale): Promise<ResolutionProtocol | null> {
  await closeExpiredResolutions();
  const row = await prisma.resolution.findFirst({
    where: { id, status: 'CLOSED' },
    select: {
      id: true,
      reference: true,
      openedAt: true,
      closesAt: true,
      closedAt: true,
      eligibleVoterCount: true,
      createdBy: { select: { name: true, email: true } },
      translations: { select: { locale: true, title: true, description: true } },
      options: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, translations: { select: { locale: true, label: true } } },
      },
      votes: {
        select: { voteOptionId: true, createdAt: true, user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!row?.openedAt || !row.closedAt) return null;
  const t = pickTranslation(row.translations, locale);
  if (!t) return null;

  const optionIds = row.options.map((o) => o.id);
  const counts = new Map<string, number>();
  for (const vote of row.votes) counts.set(vote.voteOptionId, (counts.get(vote.voteOptionId) ?? 0) + 1);

  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const votes = row.votes
    .map((v) => ({ name: v.user.name, email: v.user.email, optionId: v.voteOptionId, castAt: v.createdAt }))
    .sort((a, b) => collator.compare(a.name ?? a.email, b.name ?? b.email));

  return {
    id: row.id,
    reference: row.reference,
    title: t.title,
    description: t.description,
    contentLocale: t.locale,
    createdBy: row.createdBy ? (row.createdBy.name ?? row.createdBy.email) : null,
    openedAt: row.openedAt,
    closesAt: row.closesAt,
    closedAt: row.closedAt,
    options: row.options.map((o) => ({
      id: o.id,
      label: pickTranslation(o.translations, locale)?.label ?? `#${o.order + 1}`,
    })),
    results: tallyVotes({
      optionIds,
      counts,
      eligible: row.eligibleVoterCount ?? row.votes.length,
      eligibleIsFinal: true,
    }),
    votes,
  };
}

// ── Moderator views ───────────────────────────────────────────────────────────

export type AdminResolutionRow = {
  id: string;
  reference: string | null;
  title: string;
  status: ResolutionStatus;
  locales: Locale[];
  optionCount: number;
  voteCount: number;
  openedAt: Date | null;
  closesAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date;
};

export async function listResolutionsForAdmin(locale: Locale): Promise<AdminResolutionRow[]> {
  await closeExpiredResolutions();
  const rows = await prisma.resolution.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      reference: true,
      status: true,
      openedAt: true,
      closesAt: true,
      closedAt: true,
      updatedAt: true,
      translations: { select: { locale: true, title: true } },
      _count: { select: { options: true, votes: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: pickTranslation(row.translations, locale)?.title ?? row.id,
    status: row.status,
    locales: row.translations.map((t) => t.locale),
    optionCount: row._count.options,
    voteCount: row._count.votes,
    openedAt: row.openedAt,
    closesAt: row.closesAt,
    closedAt: row.closedAt,
    updatedAt: row.updatedAt,
  }));
}

/** Form values + status for the editor (only DRAFT resolutions are editable). */
export async function getResolutionForEdit(
  id: string,
): Promise<{ status: ResolutionStatus; values: ResolutionFormValues } | null> {
  const row = await prisma.resolution.findUnique({
    where: { id },
    select: {
      status: true,
      reference: true,
      imageUrl: true,
      attachmentUrl: true,
      closesAt: true,
      translations: { select: { locale: true, title: true, description: true } },
      options: { orderBy: { order: 'asc' }, select: { translations: { select: { locale: true, label: true } } } },
    },
  });
  if (!row) return null;

  const options: OptionLabels[] = row.options.map((o) => {
    const labels: OptionLabels = { en: '', pl: '', es: '', fr: '' };
    for (const t of o.translations) labels[t.locale] = t.label;
    return labels;
  });

  const values = emptyResolutionForm(options);
  values.reference = row.reference ?? '';
  values.imageUrl = row.imageUrl ?? '';
  values.attachmentUrl = row.attachmentUrl ?? '';
  values.closesAt = row.closesAt ? utcToZonedDateTimeInput(row.closesAt, env.APP_TIME_ZONE) : '';
  for (const t of row.translations) values.translations[t.locale] = { title: t.title, description: t.description };
  return { status: row.status, values };
}
