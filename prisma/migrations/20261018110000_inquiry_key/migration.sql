-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "inquiryKey" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailUnsubKey" SET DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE UNIQUE INDEX "Thread_inquiryKey_key" ON "Thread"("inquiryKey");
