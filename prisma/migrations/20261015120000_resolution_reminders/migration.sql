-- When the "deadline tomorrow" reminder was sent (at most once per resolution).
ALTER TABLE "resolutions" ADD COLUMN "reminderSentAt" TIMESTAMPTZ(3);
