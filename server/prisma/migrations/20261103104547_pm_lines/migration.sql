-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PRODUCTION_MANAGER';

-- AlterTable
ALTER TABLE "Line" ADD COLUMN     "pmUserId" TEXT;

-- CreateIndex
CREATE INDEX "Line_pmUserId_idx" ON "Line"("pmUserId");

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_pmUserId_fkey" FOREIGN KEY ("pmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

