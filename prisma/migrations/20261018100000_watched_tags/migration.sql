-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'SELLER_OPEN_TO_TAG';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tagId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailUnsubKey" SET DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "BuyerTagInterest" (
    "buyerUserId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "notifyOnNewSeller" BOOLEAN NOT NULL DEFAULT true,
    "lastRequestedAt" TIMESTAMP(3) NOT NULL,
    "mutedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerTagInterest_pkey" PRIMARY KEY ("buyerUserId","tagId")
);

-- CreateIndex
CREATE INDEX "BuyerTagInterest_tagId_notifyOnNewSeller_lastRequestedAt_idx" ON "BuyerTagInterest"("tagId", "notifyOnNewSeller", "lastRequestedAt" DESC);

-- AddForeignKey
ALTER TABLE "BuyerTagInterest" ADD CONSTRAINT "BuyerTagInterest_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerTagInterest" ADD CONSTRAINT "BuyerTagInterest_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
