-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "lockedPmId" TEXT;

-- CreateIndex
CREATE INDEX "Device_lockedPmId_idx" ON "Device"("lockedPmId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_lockedPmId_fkey" FOREIGN KEY ("lockedPmId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

