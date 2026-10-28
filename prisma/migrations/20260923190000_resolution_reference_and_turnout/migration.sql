-- Resolution number as the community writes it, and turnout frozen at closing.
ALTER TABLE "resolutions" ADD COLUMN "reference" VARCHAR(40);
ALTER TABLE "resolutions" ADD COLUMN "eligibleVoterCount" INTEGER;

ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_eligible_voters_chk" CHECK (
  "eligibleVoterCount" IS NULL OR ("status" = 'CLOSED' AND "eligibleVoterCount" >= 0)
);

-- ── Lifecycle is one-way, and an opened resolution is frozen ───────────────────
-- DRAFT → ACTIVE → CLOSED only. Once opened, nothing members voted on may change:
-- reference, image, attachment, deadline and opening time are locked; once closed,
-- the closing record (closedAt, eligibleVoterCount) is locked too.
CREATE OR REPLACE FUNCTION "enforce_resolution_lifecycle"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'DRAFT'  AND NEW."status" = 'ACTIVE') OR
       (OLD."status" = 'ACTIVE' AND NEW."status" = 'CLOSED')
     ) THEN
    RAISE EXCEPTION 'resolution % cannot move from % to %', OLD."id", OLD."status", NEW."status";
  END IF;

  IF OLD."status" <> 'DRAFT' AND (
       NEW."reference"     IS DISTINCT FROM OLD."reference" OR
       NEW."imageUrl"      IS DISTINCT FROM OLD."imageUrl" OR
       NEW."attachmentUrl" IS DISTINCT FROM OLD."attachmentUrl" OR
       NEW."closesAt"      IS DISTINCT FROM OLD."closesAt" OR
       NEW."openedAt"      IS DISTINCT FROM OLD."openedAt"
     ) THEN
    RAISE EXCEPTION 'resolution % is locked after opening', OLD."id";
  END IF;

  IF OLD."status" = 'CLOSED' AND (
       NEW."closedAt"           IS DISTINCT FROM OLD."closedAt" OR
       NEW."eligibleVoterCount" IS DISTINCT FROM OLD."eligibleVoterCount"
     ) THEN
    RAISE EXCEPTION 'resolution % is closed and cannot change', OLD."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "resolutions_lifecycle"
  BEFORE UPDATE ON "resolutions"
  FOR EACH ROW EXECUTE FUNCTION "enforce_resolution_lifecycle"();

-- ── Text and options are editable only while DRAFT ─────────────────────────────
-- A missing parent (cascade delete of a draft) is allowed through.
CREATE OR REPLACE FUNCTION "forbid_resolution_content_change"() RETURNS trigger AS $$
DECLARE
  row_data record;
  parent_id text;
  parent_status "ResolutionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;

  IF TG_TABLE_NAME = 'vote_option_translations' THEN
    SELECT "resolutionId" INTO parent_id FROM "vote_options" WHERE "id" = row_data."voteOptionId";
  ELSE
    parent_id := row_data."resolutionId";
  END IF;

  SELECT "status" INTO parent_status FROM "resolutions" WHERE "id" = parent_id;
  IF parent_status IS NOT NULL AND parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'resolution % is locked after opening (% on %)', parent_id, TG_OP, TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "resolution_translations_locked"
  BEFORE INSERT OR UPDATE OR DELETE ON "resolution_translations"
  FOR EACH ROW EXECUTE FUNCTION "forbid_resolution_content_change"();

CREATE TRIGGER "vote_options_locked"
  BEFORE INSERT OR UPDATE OR DELETE ON "vote_options"
  FOR EACH ROW EXECUTE FUNCTION "forbid_resolution_content_change"();

CREATE TRIGGER "vote_option_translations_locked"
  BEFORE INSERT OR UPDATE OR DELETE ON "vote_option_translations"
  FOR EACH ROW EXECUTE FUNCTION "forbid_resolution_content_change"();
