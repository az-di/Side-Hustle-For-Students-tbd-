-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('NO_SHOW', 'ABUSIVE', 'SCAM', 'ACADEMIC_DISHONESTY', 'OFF_PLATFORM_PRESSURE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UPHELD', 'DISMISSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "jobId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerUserId","blockedUserId")
);

-- CreateTable
CREATE TABLE "UserTrust" (
    "userId" TEXT NOT NULL,
    "negativeReportCount" INTEGER NOT NULL DEFAULT 0,
    "autoSuspendedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrust_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Report_subjectUserId_status_idx" ON "Report"("subjectUserId", "status");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterUserId_subjectUserId_scopeKey_key" ON "Report"("reporterUserId", "subjectUserId", "scopeKey");

-- CreateIndex
CREATE INDEX "Block_blockedUserId_blockerUserId_idx" ON "Block"("blockedUserId", "blockerUserId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrust" ADD CONSTRAINT "UserTrust_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the application must not be trusted with (same spirit as the
-- invariants migration): nobody reports or blocks themselves, weights are
-- positive, and a report's scope key agrees with its job column.
ALTER TABLE "Report"
  ADD CONSTRAINT report_no_self CHECK ("reporterUserId" <> "subjectUserId");
ALTER TABLE "Report"
  ADD CONSTRAINT report_weight_positive CHECK ("weight" > 0);
ALTER TABLE "Block"
  ADD CONSTRAINT block_no_self CHECK ("blockerUserId" <> "blockedUserId");

-- The report queue only ever scans open rows.
CREATE INDEX report_open_queue
  ON "Report"("createdAt" DESC)
  WHERE "status" = 'OPEN';

-- The one number the spec leaves TBD. Tunable in Prisma Studio, no deploy needed.
INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
  VALUES ('report_suspend_threshold', '3', now())
  ON CONFLICT ("key") DO NOTHING;
