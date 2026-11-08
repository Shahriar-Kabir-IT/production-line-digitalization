-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SYS_ADMIN';

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedLineId" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_lockedLineId_idx" ON "Device"("lockedLineId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_lockedLineId_fkey" FOREIGN KEY ("lockedLineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

