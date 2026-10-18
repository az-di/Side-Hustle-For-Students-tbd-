-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailUnsubKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundEmail_dedupeKey_key" ON "OutboundEmail"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboundEmail_status_sendAfter_idx" ON "OutboundEmail"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "OutboundEmail_userId_createdAt_idx" ON "OutboundEmail"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailUnsubKey_key" ON "User"("emailUnsubKey");

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The drain only ever scans rows that are due.
CREATE INDEX outbound_email_due
  ON "OutboundEmail"("sendAfter")
  WHERE "status" = 'PENDING';
