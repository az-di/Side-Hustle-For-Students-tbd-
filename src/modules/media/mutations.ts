import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { invalid, notAllowed, notFound } from "@/lib/errors";
import { consumeRateLimit } from "@/modules/ratelimit/mutations";
import { MAX_CAPTION_LENGTH, checkUploadLimits, sniffMediaType } from "./state";
import { newStorageKey, removeMedia, writeMedia } from "./storage";

/**
 * Media writes. The file lands on disk BEFORE the row is committed, and the
 * row is deleted BEFORE the file is removed, so the worst case of a crash is
 * an orphaned file on the volume — never a row pointing at nothing.
 */

export async function uploadPortfolioMedia(params: {
  sellerUserId: string;
  bytes: Uint8Array;
  caption?: string | null;
}): Promise<{ itemId: string; assetId: string }> {
  const sniffed = sniffMediaType(params.bytes);
  if (!sniffed) throw invalid("Upload a JPG, PNG, GIF, WebP, MP4, MOV, WebM or PDF.");

  const caption = params.caption?.trim() || null;
  if (caption && caption.length > MAX_CAPTION_LENGTH) throw invalid("Keep the caption short.");

  const profile = await db.sellerProfile.findUnique({ where: { userId: params.sellerUserId }, select: { userId: true } });
  if (!profile) throw notAllowed("Set up a seller profile first.");

  const [used, itemCount] = await Promise.all([
    db.mediaAsset.aggregate({ where: { ownerUserId: params.sellerUserId }, _sum: { bytes: true } }),
    db.portfolioItem.count({ where: { sellerUserId: params.sellerUserId } }),
  ]);

  const limits = checkUploadLimits({
    bytes: params.bytes.byteLength,
    usedBytes: used._sum.bytes ?? 0,
    itemCount,
    maxFileBytes: env.MEDIA_MAX_FILE_BYTES,
    maxTotalBytes: env.MEDIA_MAX_TOTAL_BYTES,
  });
  if (!limits.ok) throw invalid(limits.message);
  await consumeRateLimit("upload", params.sellerUserId);

  const storageKey = newStorageKey(sniffed.ext);
  await writeMedia(storageKey, params.bytes);

  try {
    const last = await db.portfolioItem.findFirst({
      where: { sellerUserId: params.sellerUserId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    return await db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          ownerUserId: params.sellerUserId,
          kind: sniffed.kind,
          mimeType: sniffed.mimeType,
          bytes: params.bytes.byteLength,
          storageKey,
        },
        select: { id: true },
      });
      const item = await tx.portfolioItem.create({
        data: {
          sellerUserId: params.sellerUserId,
          assetId: asset.id,
          caption,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      return { itemId: item.id, assetId: asset.id };
    });
  } catch (err) {
    await removeMedia(storageKey).catch(() => {});
    throw err;
  }
}

export async function deletePortfolioItem(params: { sellerUserId: string; itemId: string }): Promise<void> {
  const item = await db.portfolioItem.findUnique({
    where: { id: params.itemId },
    select: { sellerUserId: true, asset: { select: { id: true, storageKey: true } } },
  });
  if (!item) throw notFound("That portfolio item");
  if (item.sellerUserId !== params.sellerUserId) throw notAllowed();

  // Deleting the asset cascades to the item.
  await db.mediaAsset.delete({ where: { id: item.asset.id } });
  await removeMedia(item.asset.storageKey);
}
