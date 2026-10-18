import type { MediaKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { mediaUrl } from "./state";

export type PortfolioItemDto = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  url: string;
  caption: string | null;
  bytes: number;
};

export async function listPortfolio(sellerUserId: string): Promise<PortfolioItemDto[]> {
  const rows = await db.portfolioItem.findMany({
    where: { sellerUserId },
    select: {
      id: true,
      caption: true,
      asset: { select: { kind: true, mimeType: true, storageKey: true, bytes: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    kind: r.asset.kind,
    mimeType: r.asset.mimeType,
    url: mediaUrl(r.asset.storageKey),
    caption: r.caption,
    bytes: r.asset.bytes,
  }));
}

export async function mediaUsage(userId: string): Promise<{ usedBytes: number; maxBytes: number }> {
  const agg = await db.mediaAsset.aggregate({ where: { ownerUserId: userId }, _sum: { bytes: true } });
  return { usedBytes: agg._sum.bytes ?? 0, maxBytes: env.MEDIA_MAX_TOTAL_BYTES };
}

/** For the serving route: the row decides the content type, not the extension. */
export async function getAssetByKey(storageKey: string) {
  return db.mediaAsset.findUnique({
    where: { storageKey },
    select: { mimeType: true, bytes: true, storageKey: true },
  });
}
