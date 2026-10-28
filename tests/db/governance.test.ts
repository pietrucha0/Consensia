/**
 * Database-level guarantees (triggers, constraints) — the rules that must hold even if
 * application code has a bug. Runs against a DISPOSABLE database:
 *
 *   TEST_DATABASE_URL=postgresql://…/consensia_test npm run test:db
 *
 * The database name must contain "test"; every table is truncated before the run.
 * Apply migrations first: DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '@/generated/prisma/client';

const url = process.env.TEST_DATABASE_URL;
const enabled = Boolean(url && /test/i.test(new URL(url).pathname));

describe.runIf(enabled)('database governance rules', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? '' }) });

  let adminId = '';
  let memberId = '';
  let otherMemberId = '';

  async function user(email: string, role: 'USER' | 'MODERATOR' | 'ADMIN' = 'USER') {
    const created = await prisma.user.create({
      data: { email, name: email, role, emailVerified: new Date(), passwordHash: 'x' },
    });
    return created.id;
  }

  /** DRAFT resolution with a PL translation and two options; returns ids. */
  async function draft(reference: string) {
    const resolution = await prisma.resolution.create({
      data: {
        reference,
        createdById: adminId,
        translations: { create: [{ locale: 'pl', title: `Uchwała ${reference}`, description: 'Uzasadnienie' }] },
        options: {
          create: [
            { order: 0, translations: { create: [{ locale: 'pl', label: 'Za' }] } },
            { order: 1, translations: { create: [{ locale: 'pl', label: 'Przeciw' }] } },
          ],
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return { id: resolution.id, optionIds: resolution.options.map((o) => o.id) };
  }

  async function open(id: string) {
    await prisma.resolution.update({ where: { id }, data: { status: 'ACTIVE', openedAt: new Date() } });
  }

  beforeAll(async () => {
    // TRUNCATE does not fire row triggers, so the immutable tables can be reset here.
    await prisma.$executeRawUnsafe(`
      TRUNCATE votes, vote_option_translations, vote_options, resolution_translations, resolutions,
               article_translations, articles, audit_logs, rate_limits, sessions, accounts,
               verification_tokens, password_reset_tokens, email_change_requests, users CASCADE`);
    adminId = await user('admin@test.local', 'ADMIN');
    memberId = await user('member@test.local');
    otherMemberId = await user('other@test.local');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('votes', () => {
    it('allows exactly one vote per member and resolution', async () => {
      const r = await draft('V1');
      await open(r.id);
      await prisma.vote.create({ data: { userId: memberId, resolutionId: r.id, voteOptionId: r.optionIds[0]! } });
      await expect(
        prisma.vote.create({ data: { userId: memberId, resolutionId: r.id, voteOptionId: r.optionIds[1]! } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('never lets a stored vote be changed or deleted', async () => {
      const vote = await prisma.vote.findFirstOrThrow({ where: { userId: memberId } });
      const other = await prisma.voteOption.findFirstOrThrow({
        where: { resolutionId: vote.resolutionId, id: { not: vote.voteOptionId } },
      });
      await expect(prisma.vote.update({ where: { id: vote.id }, data: { voteOptionId: other.id } })).rejects.toThrow(
        /immutable/,
      );
      await expect(prisma.vote.delete({ where: { id: vote.id } })).rejects.toThrow(/immutable/);
    });

    it('rejects an option that belongs to a different resolution', async () => {
      const a = await draft('V2a');
      const b = await draft('V2b');
      await open(a.id);
      await open(b.id);
      await expect(
        prisma.vote.create({ data: { userId: otherMemberId, resolutionId: a.id, voteOptionId: b.optionIds[0]! } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('only accepts votes while the resolution is open and before its deadline', async () => {
      const notOpen = await draft('V3');
      await expect(
        prisma.vote.create({ data: { userId: memberId, resolutionId: notOpen.id, voteOptionId: notOpen.optionIds[0]! } }),
      ).rejects.toThrow(/not open for voting/);

      const late = await draft('V4');
      await prisma.resolution.update({
        where: { id: late.id },
        data: { status: 'ACTIVE', openedAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() - 1_000) },
      });
      await expect(
        prisma.vote.create({ data: { userId: memberId, resolutionId: late.id, voteOptionId: late.optionIds[0]! } }),
      ).rejects.toThrow(/not open for voting/);
    });

    it('keeps a resolution with votes from being deleted', async () => {
      const vote = await prisma.vote.findFirstOrThrow({ where: { userId: memberId } });
      await expect(prisma.resolution.delete({ where: { id: vote.resolutionId } })).rejects.toThrow();
    });
  });

  describe('resolution lifecycle', () => {
    it('locks the wording and options once voting opens', async () => {
      const r = await draft('L1');
      await open(r.id);
      await expect(
        prisma.resolutionTranslation.updateMany({ where: { resolutionId: r.id }, data: { title: 'Changed' } }),
      ).rejects.toThrow(/locked after opening/);
      await expect(
        prisma.voteOption.create({ data: { resolutionId: r.id, order: 2 } }),
      ).rejects.toThrow(/locked after opening/);
      await expect(prisma.resolution.update({ where: { id: r.id }, data: { closesAt: new Date() } })).rejects.toThrow(
        /locked after opening/,
      );
    });

    it('only moves forward: DRAFT → ACTIVE → CLOSED', async () => {
      const r = await draft('L2');
      await expect(
        prisma.resolution.update({ where: { id: r.id }, data: { status: 'CLOSED', closedAt: new Date() } }),
      ).rejects.toThrow();
      await open(r.id);
      await expect(
        prisma.resolution.update({ where: { id: r.id }, data: { status: 'DRAFT', openedAt: null } }),
      ).rejects.toThrow();
      await prisma.resolution.update({
        where: { id: r.id },
        data: { status: 'CLOSED', closedAt: new Date(), eligibleVoterCount: 3 },
      });
      await expect(prisma.resolution.update({ where: { id: r.id }, data: { eligibleVoterCount: 99 } })).rejects.toThrow(
        /closed and cannot change/,
      );
    });
  });

  describe('audit log', () => {
    it('is append-only', async () => {
      const entry = await prisma.auditLog.create({ data: { actorId: adminId, action: 'USER_ENABLED', targetLabel: 'x' } });
      await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { targetLabel: 'y' } })).rejects.toThrow(
        /append-only/,
      );
      await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    });

    it('survives deletion of the acting user (actor becomes null)', async () => {
      const temp = await user('temp@test.local');
      const entry = await prisma.auditLog.create({ data: { actorId: temp, action: 'PASSWORD_CHANGED' } });
      await prisma.user.delete({ where: { id: temp } });
      expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: entry.id } })).actorId).toBeNull();
    });
  });

  describe('administrators', () => {
    it('refuses to demote or disable the last active administrator', async () => {
      await expect(prisma.user.update({ where: { id: adminId }, data: { role: 'USER' } })).rejects.toThrow(
        /last active administrator/,
      );
      await expect(prisma.user.update({ where: { id: adminId }, data: { disabledAt: new Date() } })).rejects.toThrow(
        /last active administrator/,
      );
    });

    it('allows it while another active administrator remains', async () => {
      const second = await user('second-admin@test.local', 'ADMIN');
      await prisma.user.update({ where: { id: second }, data: { role: 'MODERATOR' } });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: second } })).role).toBe('MODERATOR');
    });
  });
});
