-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_ROLE_CHANGED', 'USER_DISABLED', 'USER_ENABLED', 'PASSWORD_CHANGED', 'ARTICLE_CREATED', 'ARTICLE_UPDATED', 'ARTICLE_PUBLISHED', 'ARTICLE_DELETED', 'RESOLUTION_CREATED', 'RESOLUTION_UPDATED', 'RESOLUTION_OPENED', 'RESOLUTION_CLOSED', 'RESOLUTION_DELETED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifyNewResolutions" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetId" VARCHAR(64),
    "targetLabel" VARCHAR(300),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written: audit log is append-only
-- ─────────────────────────────────────────────────────────────────────────────
-- The only permitted change is the ON DELETE SET NULL of actorId when a user row is
-- removed (e.g. an abandoned, never-verified sign-up).
CREATE OR REPLACE FUNCTION forbid_audit_log_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."actorId" IS NULL
     AND OLD."actorId" IS NOT NULL
     AND (to_jsonb(NEW) - 'actorId') = (to_jsonb(OLD) - 'actorId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit log entries are append-only' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written: never lose the last active administrator
-- ─────────────────────────────────────────────────────────────────────────────
-- Demoting, disabling or deleting an active ADMIN is refused when no other active
-- ADMIN would remain. The advisory lock serialises concurrent changes, so two admins
-- cannot demote each other at the same moment and leave nobody in charge.
CREATE OR REPLACE FUNCTION keep_one_active_admin() RETURNS trigger AS $$
DECLARE
  remaining integer;
BEGIN
  IF OLD."role" <> 'ADMIN' OR OLD."disabledAt" IS NOT NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."role" = 'ADMIN' AND NEW."disabledAt" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('consensia.active_admins'));
  SELECT count(*) INTO remaining
    FROM "users"
   WHERE "role" = 'ADMIN' AND "disabledAt" IS NULL AND "id" <> OLD."id";
  IF remaining = 0 THEN
    RAISE EXCEPTION 'the last active administrator cannot be removed' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_keep_one_active_admin
  BEFORE UPDATE OF "role", "disabledAt" OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION keep_one_active_admin();
