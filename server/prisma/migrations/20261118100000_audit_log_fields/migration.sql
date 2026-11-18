-- Enrich AuditLog with actor snapshot, IP, and a human-readable summary.
ALTER TABLE "AuditLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ip" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "summary" TEXT;

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
