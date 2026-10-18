-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'PDF');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailUnsubKey" SET DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerUserId_createdAt_idx" ON "MediaAsset"("ownerUserId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_assetId_key" ON "PortfolioItem"("assetId");

-- CreateIndex
CREATE INDEX "PortfolioItem_sellerUserId_sortOrder_createdAt_idx" ON "PortfolioItem"("sellerUserId", "sortOrder", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A storage key is a bare filename: no path separators, nothing hidden.
ALTER TABLE "MediaAsset"
  ADD CONSTRAINT media_asset_key_shape CHECK ("storageKey" ~ '^[a-z0-9]+\.[a-z0-9]+$');
ALTER TABLE "MediaAsset"
  ADD CONSTRAINT media_asset_bytes_positive CHECK ("bytes" > 0);
