-- Optional per-hour reason note (e.g. why output was low that hour).
ALTER TABLE "HourlyEntry" ADD COLUMN IF NOT EXISTS "reason" TEXT;
