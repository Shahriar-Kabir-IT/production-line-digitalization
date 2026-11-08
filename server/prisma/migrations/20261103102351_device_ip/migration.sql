-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "Device_ipAddress_idx" ON "Device"("ipAddress");

