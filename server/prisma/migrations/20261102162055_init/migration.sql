-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'WORK_STUDY', 'LINE_WORKER');

-- CreateTable
CREATE TABLE "Factory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "factoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "factoryId" TEXT,
    "lineId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectCode" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DefectCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "WorkStudyPlan" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "buyerId" TEXT,
    "buyerName" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "smv" DOUBLE PRECISION NOT NULL,
    "manpower" INTEGER NOT NULL,
    "dayTarget" INTEGER NOT NULL,
    "plannedHours" INTEGER NOT NULL DEFAULT 11,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "hourIndex" INTEGER NOT NULL,
    "hourLabel" TEXT NOT NULL,
    "checkedQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HourlyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyDefect" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HourlyDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Factory_code_key" ON "Factory"("code");

-- CreateIndex
CREATE INDEX "Line_factoryId_idx" ON "Line"("factoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Line_factoryId_name_key" ON "Line"("factoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_name_key" ON "Buyer"("name");

-- CreateIndex
CREATE INDEX "WorkStudyPlan_date_idx" ON "WorkStudyPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStudyPlan_lineId_date_key" ON "WorkStudyPlan"("lineId", "date");

-- CreateIndex
CREATE INDEX "HourlyEntry_planId_idx" ON "HourlyEntry"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyEntry_planId_hourIndex_key" ON "HourlyEntry"("planId", "hourIndex");

-- CreateIndex
CREATE INDEX "HourlyDefect_code_idx" ON "HourlyDefect"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyDefect_entryId_code_key" ON "HourlyDefect"("entryId", "code");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStudyPlan" ADD CONSTRAINT "WorkStudyPlan_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStudyPlan" ADD CONSTRAINT "WorkStudyPlan_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStudyPlan" ADD CONSTRAINT "WorkStudyPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyEntry" ADD CONSTRAINT "HourlyEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkStudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyDefect" ADD CONSTRAINT "HourlyDefect_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HourlyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyDefect" ADD CONSTRAINT "HourlyDefect_code_fkey" FOREIGN KEY ("code") REFERENCES "DefectCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

