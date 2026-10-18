import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Tx } from "@/lib/tx";
import { enqueueDigestsForNotificationKey } from "@/modules/email/outbox";
import { notBlockedSql } from "@/modules/trust/block-filter";
import { MAX_WATCHERS_PER_EVENT, sellerOpenDedupeKey, watchWindowStart } from "./state";

/**
 * Buyer tag interests: recorded on every request, consulted when a seller
 * becomes open to a tag.
 */

/** Called from both request creators. Never deletes; a closed request keeps the interest. */
export async function recordInterest(tx: Tx, params: { buyerUserId: string; tagIds: string[] }, now = new Date()): Promise<void> {
  for (const tagId of params.tagIds) {
    await tx.buyerTagInterest.upsert({
      where: { buyerUserId_tagId: { buyerUserId: params.buyerUserId, tagId } },
      create: { buyerUserId: params.buyerUserId, tagId, lastRequestedAt: now },
      update: { lastRequestedAt: now },
    });
  }
}

export async function setInterestPreference(params: {
  buyerUserId: string;
  tagId: string;
  notifyOnNewSeller: boolean;
}): Promise<void> {
  await db.buyerTagInterest.updateMany({
    where: { buyerUserId: params.buyerUserId, tagId: params.tagId },
    data: { notifyOnNewSeller: params.notifyOnNewSeller },
  });
}

export async function setAllInterestPreferences(params: { buyerUserId: string; notifyOnNewSeller: boolean }): Promise<void> {
  await db.buyerTagInterest.updateMany({
    where: { buyerUserId: params.buyerUserId },
    data: { notifyOnNewSeller: params.notifyOnNewSeller },
  });
}

/**
 * Tells watching buyers that a seller is now open to these tags.
 *
 * The three triggers (seller adds a tag, resumes from pause, publishes a
 * listing under a tag) all funnel through here. The dedupe is the whole
 * difficulty, and it lives in the dedupe key: at most one alert per buyer per
 * seller per tag per month, enforced by @@unique([userId, dedupeKey]).
 *
 * Set-based, like the open-request fan-out, with the limits applied in SQL:
 * only watchers active in the last 90 days, opted in, not muted, not the
 * seller themselves, not blocked either way, capped at the 200 most recently
 * active per tag.
 */
export async function notifyWatchers(
  tx: Tx,
  params: { sellerUserId: string; tagIds: string[] },
  now = new Date(),
): Promise<number> {
  if (params.tagIds.length === 0) return 0;

  // A paused or non-active seller is not "open" to anything.
  const seller = await tx.user.findUnique({
    where: { id: params.sellerUserId },
    select: { status: true, sellerProfile: { select: { isAvailable: true } } },
  });
  if (!seller || seller.status !== "ACTIVE" || !seller.sellerProfile?.isAvailable) return 0;

  let total = 0;
  for (const tagId of params.tagIds) {
    const dedupeKey = sellerOpenDedupeKey(params.sellerUserId, tagId, now);

    const inserted = await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Notification" ("id", "userId", "kind", "tagId", "actorUserId", "dedupeKey", "createdAt")
      SELECT
        gen_random_uuid()::text,
        w."buyerUserId",
        'SELLER_OPEN_TO_TAG'::"NotificationKind",
        ${tagId},
        ${params.sellerUserId},
        ${dedupeKey},
        ${now}
      FROM "BuyerTagInterest" w
      JOIN "User" u ON u."id" = w."buyerUserId"
      WHERE w."tagId" = ${tagId}
        AND w."notifyOnNewSeller"
        AND (w."mutedUntil" IS NULL OR w."mutedUntil" <= ${now})
        AND w."lastRequestedAt" >= ${watchWindowStart(now)}
        AND w."buyerUserId" <> ${params.sellerUserId}
        AND u."status" = 'ACTIVE'::"UserStatus"
        AND ${notBlockedSql(params.sellerUserId, Prisma.sql`w."buyerUserId"`)}
      ORDER BY w."lastRequestedAt" DESC
      LIMIT ${MAX_WATCHERS_PER_EVENT}
      ON CONFLICT ("userId", "dedupeKey") DO NOTHING
    `);

    if (inserted > 0) await enqueueDigestsForNotificationKey(tx, dedupeKey, now);
    total += inserted;
  }
  return total;
}
