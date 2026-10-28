-- Required by the GIN trigram index on article_translations.title
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'pl', 'es', 'fr');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120),
    "email" VARCHAR(254) NOT NULL,
    "emailVerified" TIMESTAMPTZ(3),
    "image" VARCHAR(2048),
    "passwordHash" VARCHAR(255),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "preferredLocale" "Locale" NOT NULL DEFAULT 'en',
    "disabledAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "passwordHash" VARCHAR(255),
    "name" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "heroImageUrl" VARCHAR(2048),
    "authorId" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translations" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "body" JSONB NOT NULL,
    "footer" TEXT,
    "heroImageAlt" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "imageUrl" VARCHAR(2048),
    "attachmentUrl" VARCHAR(2048),
    "createdById" TEXT,
    "openedAt" TIMESTAMPTZ(3),
    "closesAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_translations" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resolution_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_options" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "vote_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_option_translations" (
    "voteOptionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" VARCHAR(120) NOT NULL,

    CONSTRAINT "vote_option_translations_pkey" PRIMARY KEY ("voteOptionId","locale")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "voteOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_identifier_createdAt_idx" ON "verification_tokens"("identifier", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_createdAt_idx" ON "password_reset_tokens"("email", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "articles_authorId_idx" ON "articles"("authorId");

-- CreateIndex
CREATE INDEX "article_translations_title_idx" ON "article_translations" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "article_translations_articleId_locale_key" ON "article_translations"("articleId", "locale");

-- CreateIndex
CREATE INDEX "resolutions_status_createdAt_idx" ON "resolutions"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "resolutions_createdById_idx" ON "resolutions"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "resolution_translations_resolutionId_locale_key" ON "resolution_translations"("resolutionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "vote_options_resolutionId_order_key" ON "vote_options"("resolutionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "vote_options_id_resolutionId_key" ON "vote_options"("id", "resolutionId");

-- CreateIndex
CREATE INDEX "votes_resolutionId_voteOptionId_idx" ON "votes"("resolutionId", "voteOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_userId_resolutionId_key" ON "votes"("userId", "resolutionId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_translations" ADD CONSTRAINT "resolution_translations_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "resolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_options" ADD CONSTRAINT "vote_options_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "resolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_option_translations" ADD CONSTRAINT "vote_option_translations_voteOptionId_fkey" FOREIGN KEY ("voteOptionId") REFERENCES "vote_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "resolutions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voteOptionId_resolutionId_fkey" FOREIGN KEY ("voteOptionId", "resolutionId") REFERENCES "vote_options"("id", "resolutionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ════ Governance constraints (prisma/sql/governance_constraints.sql) ════

-- ── Resolution lifecycle: timestamps must agree with status ────────────────────
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_lifecycle_chk" CHECK (
  ("status" = 'DRAFT'  AND "openedAt" IS NULL     AND "closedAt" IS NULL) OR
  ("status" = 'ACTIVE' AND "openedAt" IS NOT NULL AND "closedAt" IS NULL) OR
  ("status" = 'CLOSED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL)
);

-- ── Votes are final: no UPDATE, no DELETE ──────────────────────────────────────
CREATE OR REPLACE FUNCTION "forbid_vote_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'votes are immutable (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "votes_immutable"
  BEFORE UPDATE OR DELETE ON "votes"
  FOR EACH ROW EXECUTE FUNCTION "forbid_vote_mutation"();

-- ── Votes only while the resolution is ACTIVE (and before closesAt) ────────────
-- FOR SHARE locks the resolution row until the voting transaction commits, so a
-- concurrent ACTIVE → CLOSED update waits: no vote can land after closing.
CREATE OR REPLACE FUNCTION "enforce_vote_window"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "resolutions"
   WHERE "id" = NEW."resolutionId"
     AND "status" = 'ACTIVE'
     AND ("closesAt" IS NULL OR "closesAt" > now())
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolution % is not open for voting', NEW."resolutionId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "votes_window"
  BEFORE INSERT ON "votes"
  FOR EACH ROW EXECUTE FUNCTION "enforce_vote_window"();
