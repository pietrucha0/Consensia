-- Rules Prisma's schema language cannot express. Prisma does not introspect
-- triggers/functions/CHECK constraints, so later migrations will not try to drop them.
--
-- ALREADY APPLIED: this file is merged into prisma/migrations/*_init/migration.sql.
-- Kept as the readable reference. If you ever squash/recreate the init migration:
--   npx prisma migrate dev --create-only --name init
--   → put the pg_trgm line at the TOP of the generated migration.sql
--   → append the rest of this file at the BOTTOM

-- (top of init migration — the GIN trigram index on article_translations needs it)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
