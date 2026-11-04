/**
 * Creates (or promotes) the first ADMIN account from SEED_ADMIN_* env vars.
 * Idempotent: re-running updates the password and keeps the account verified.
 * With SEED_DEMO_CONTENT="true" it also adds demo articles (only into an empty table).
 *   npm run db:seed
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import type { RichTextBlock, RichTextDoc } from '../src/features/articles/rich-text';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME?.trim() || 'Administrator';

if (!email || !password || password.length < 12) {
  console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min. 12 characters) in .env');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main(adminEmail: string, adminPassword: string): Promise<void> {
  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name, passwordHash, role: 'ADMIN', emailVerified: new Date() },
    update: { passwordHash, role: 'ADMIN', emailVerified: new Date(), disabledAt: null, failedLoginCount: 0, lockedUntil: null },
    select: { id: true, email: true },
  });
  console.info(`✔ ADMIN ready: ${admin.email} (${admin.id})`);

  if (process.env.SEED_DEMO_CONTENT === 'true') {
    await seedDemoArticles(admin.id);
    await seedDemoResolutions(admin.id);
  }
}

// ── Demo content ──────────────────────────────────────────────────────────────

const p = (text: string): RichTextBlock => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string): RichTextBlock => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const bullets = (...items: string[]): RichTextBlock => ({
  type: 'bulletList',
  content: items.map((text) => ({ type: 'listItem', content: [p(text)] })),
});
const doc = (...content: RichTextBlock[]): RichTextDoc => ({ type: 'doc', content });
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seedDemoArticles(authorId: string): Promise<void> {
  if ((await prisma.article.count()) > 0) {
    console.info('• Demo articles skipped (articles table is not empty)');
    return;
  }

  const articles = [
    {
      slug: 'welcome-to-consensia',
      status: 'PUBLISHED' as const,
      publishedAt: daysAgo(30),
      translations: [
        {
          locale: 'en' as const,
          title: 'Welcome to Consensia',
          summary: 'Our new private platform for news, resolutions and voting — here is what you can do.',
          body: doc(
            p('Consensia brings our organisation’s announcements and decisions into one secure place.'),
            h2('What you can do'),
            bullets('Read articles and news', 'Review resolutions before they are voted on', 'Cast your vote once per resolution'),
            p('Everything is private: only verified members can sign in.'),
          ),
          footer: 'Questions? Contact the board at board@example.org.',
        },
        {
          locale: 'pl' as const,
          title: 'Witamy w Consensii',
          summary: 'Nasza nowa, prywatna platforma do komunikatów, uchwał i głosowań — zobacz, co możesz tu zrobić.',
          body: doc(
            p('Consensia zbiera komunikaty i decyzje naszej organizacji w jednym, bezpiecznym miejscu.'),
            h2('Co możesz zrobić'),
            bullets('Czytać artykuły i aktualności', 'Zapoznawać się z uchwałami przed głosowaniem', 'Oddać jeden głos na każdą uchwałę'),
            p('Wszystko jest prywatne: zalogować się mogą tylko zweryfikowani członkowie.'),
          ),
          footer: 'Pytania? Napisz do zarządu: board@example.org.',
        },
      ],
    },
    {
      slug: 'annual-general-meeting-2026',
      status: 'PUBLISHED' as const,
      publishedAt: daysAgo(9),
      translations: [
        {
          locale: 'en' as const,
          title: 'Annual General Meeting 2026',
          summary: 'Date, agenda and how to prepare for this year’s general meeting.',
          body: doc(
            p('The Annual General Meeting takes place on 15 October 2026 at 18:00.'),
            h2('Agenda'),
            bullets('Board report for 2025/2026', 'Budget for the next year', 'Election of the audit committee'),
          ),
          footer: null,
        },
        {
          locale: 'pl' as const,
          title: 'Walne Zgromadzenie 2026',
          summary: 'Termin, porządek obrad i jak przygotować się do tegorocznego zgromadzenia.',
          body: doc(
            p('Walne Zgromadzenie odbędzie się 15 października 2026 r. o godz. 18:00.'),
            h2('Porządek obrad'),
            bullets('Sprawozdanie zarządu za rok 2025/2026', 'Budżet na kolejny rok', 'Wybór komisji rewizyjnej'),
          ),
          footer: null,
        },
      ],
    },
    {
      // English only: readers in other languages see the fallback notice.
      slug: 'new-membership-fees',
      status: 'PUBLISHED' as const,
      publishedAt: daysAgo(2),
      translations: [
        {
          locale: 'en' as const,
          title: 'New membership fees from January',
          summary: 'The board proposes updated membership fees. The resolution will be put to a vote next week.',
          body: doc(p('Rising costs make an adjustment necessary. Details and the full justification are in the resolution.')),
          footer: null,
        },
      ],
    },
    {
      slug: 'draft-volunteer-programme',
      status: 'DRAFT' as const,
      publishedAt: null,
      translations: [
        {
          locale: 'pl' as const,
          title: 'Program wolontariatu (szkic)',
          summary: 'Szkic — widoczny tylko dla administratorów.',
          body: doc(p('Treść w przygotowaniu.')),
          footer: null,
        },
      ],
    },
  ];

  for (const article of articles) {
    await prisma.article.create({
      data: {
        slug: article.slug,
        status: article.status,
        publishedAt: article.publishedAt,
        authorId,
        translations: { create: article.translations },
      },
    });
  }
  console.info(`✔ ${articles.length} demo articles created`);
}

const defaultOptions = () =>
  [
    { en: 'For', pl: 'Za', es: 'A favor', fr: 'Pour' },
    { en: 'Against', pl: 'Przeciw', es: 'En contra', fr: 'Contre' },
    { en: 'Abstain', pl: 'Wstrzymuję się', es: 'Abstención', fr: 'Abstention' },
  ].map((labels, order) => ({
    order,
    translations: { create: Object.entries(labels).map(([locale, label]) => ({ locale: locale as 'en' | 'pl' | 'es' | 'fr', label })) },
  }));

async function seedDemoResolutions(authorId: string): Promise<void> {
  if ((await prisma.resolution.count()) > 0) {
    console.info('• Demo resolutions skipped (resolutions table is not empty)');
    return;
  }

  // Content can only be written while DRAFT (DB trigger), so every demo follows the real lifecycle.
  // Open for voting, deadline in 5 days.
  const open = await prisma.resolution.create({
    data: {
      reference: '7/2026',
      closesAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      createdById: authorId,
      translations: {
        create: [
          {
            locale: 'pl',
            title: 'W sprawie wymiany dźwigu osobowego w klatce B',
            description:
              'Zarząd wnosi o wyrażenie zgody na wymianę dźwigu osobowego w klatce B na nowy, spełniający aktualne normy bezpieczeństwa.\n\nKoszt inwestycji wynosi 186 000 zł brutto i zostanie pokryty z funduszu remontowego. Prace potrwają około 6 tygodni; w tym czasie mieszkańcy klatki B będą mogli korzystać z dźwigu w klatce A.\n\nUzasadnienie: obecny dźwig pochodzi z 1998 roku, w ostatnich 12 miesiącach odnotowano 9 awarii, a Urząd Dozoru Technicznego wskazał konieczność modernizacji.',
          },
          {
            locale: 'en',
            title: 'Replacement of the passenger lift in staircase B',
            description:
              'The board asks for consent to replace the passenger lift in staircase B with a new one meeting current safety standards.\n\nThe investment costs PLN 186,000 gross and will be covered from the renovation fund. Work will take about 6 weeks; meanwhile residents of staircase B can use the lift in staircase A.\n\nJustification: the current lift dates from 1998, there were 9 breakdowns in the last 12 months, and the technical inspection authority has required modernisation.',
          },
        ],
      },
      options: { create: defaultOptions() },
    },
    select: { id: true },
  });
  await prisma.resolution.update({ where: { id: open.id }, data: { status: 'ACTIVE', openedAt: daysAgo(1) } });

  // Closed, with a handful of demo ballots so results render. Demo members have no password.
  const members = await Promise.all(
    ['anna', 'bartek', 'celina'].map((handle) =>
      prisma.user.upsert({
        where: { email: `${handle}.demo@example.com` },
        create: { email: `${handle}.demo@example.com`, name: `${handle[0]!.toUpperCase()}${handle.slice(1)} (demo)`, emailVerified: new Date() },
        update: {},
        select: { id: true },
      }),
    ),
  );
  const closed = await prisma.resolution.create({
    data: {
      reference: '6/2026',
      createdById: authorId,
      translations: {
        create: [
          {
            locale: 'pl',
            title: 'W sprawie przyjęcia sprawozdania finansowego za rok 2025',
            description: 'Zarząd przedstawia sprawozdanie finansowe wspólnoty za rok 2025 i wnosi o jego przyjęcie.\n\nSprawozdanie było dostępne do wglądu w biurze zarządu od 1 sierpnia 2026 r.',
          },
          {
            locale: 'en',
            title: 'Approval of the 2025 financial statement',
            description: "The board presents the community's financial statement for 2025 and asks for its approval.\n\nThe statement was available for inspection at the board office from 1 August 2026.",
          },
        ],
      },
      options: { create: defaultOptions() },
    },
    select: { id: true, options: { orderBy: { order: 'asc' }, select: { id: true } } },
  });
  await prisma.resolution.update({ where: { id: closed.id }, data: { status: 'ACTIVE', openedAt: daysAgo(20) } });
  const [forId, againstId] = closed.options.map((o) => o.id);
  if (forId && againstId) {
    await prisma.vote.createMany({
      data: [
        // Cast while the resolution was open (between opening and closing), as in real life.
        { userId: members[0]!.id, resolutionId: closed.id, voteOptionId: forId, createdAt: daysAgo(18) },
        { userId: members[1]!.id, resolutionId: closed.id, voteOptionId: forId, createdAt: daysAgo(15) },
        { userId: members[2]!.id, resolutionId: closed.id, voteOptionId: againstId, createdAt: daysAgo(9) },
      ],
    });
  }
  const eligibleVoterCount = await prisma.user.count({ where: { emailVerified: { not: null }, disabledAt: null } });
  await prisma.resolution.update({
    where: { id: closed.id },
    data: { status: 'CLOSED', closedAt: daysAgo(6), eligibleVoterCount },
  });

  // Draft, only visible in the moderator panel.
  await prisma.resolution.create({
    data: {
      reference: '8/2026',
      createdById: authorId,
      translations: {
        create: [
          {
            locale: 'pl',
            title: 'W sprawie montażu stojaków rowerowych',
            description: 'Projekt: montaż 12 stojaków rowerowych przy wejściu do klatki A.',
          },
        ],
      },
      options: { create: defaultOptions() },
    },
  });

  console.info('✔ 3 demo resolutions created (open, closed with votes, draft)');
}

main(email, password)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
