-- Mark ad-hoc station-added defect codes so they stay out of the standard grid.
ALTER TABLE "DefectCode" ADD COLUMN IF NOT EXISTS "custom" BOOLEAN NOT NULL DEFAULT false;
