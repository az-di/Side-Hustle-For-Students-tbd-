import { Prisma } from "@/generated/prisma/client";
import type { NotificationKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { Tx } from "@/lib/tx";
import { enqueueDigestsForNotificationKey, enqueueForNotifications } from "@/modules/email/outbox";
import { notBlockedSql } from "@/modules/trust/block-filter";

/**
 * Notification writes.
 *
 * Two rules hold this together:
 *
 *  1. Rows are written in the SAME transaction as the state change they
 *     describe, so a notification can never disagree with the data.
 *  2. Every row carries a dedupeKey, backed by @@unique([userId, dedupeKey]).
 *     Combined with skipDuplicates / ON CONFLICT DO NOTHING, that makes every
 *     write idempotent — double-clicks, retries and re-run sweeps are harmless.
 *
 * Payloads hold IDS ONLY. Never a rendered string like "New request: $100 for
 * photos": a notification row is read by whoever it belongs to, so a
 * pre-rendered money figure would leak the buyer's gross budget to sellers.
 *
 * Email rides along: every notification written here also queues its email
 * (modules/email/outbox.ts) in the same transaction, so no mutation has to
 * remember to.
 */

export type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  actorUserId?: string | null;
  requestId?: string | null;
  jobId?: string | null;
  threadId?: string | null;
};

export async function notify(tx: Tx, input: NotifyInput | NotifyInput[]): Promise<number> {
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length === 0) return 0;

  // createManyAndReturn + skipDuplicates returns only the rows actually
  // inserted, which is exactly the set that owes an email.
  const inserted = await tx.notification.createManyAndReturn({
    data: rows.map((r) => ({
      userId: r.userId,
      kind: r.kind,
      dedupeKey: r.dedupeKey,
      actorUserId: r.actorUserId ?? null,
      requestId: r.requestId ?? null,
      jobId: r.jobId ?? null,
      threadId: r.threadId ?? null,
    })),
    skipDuplicates: true,
    select: { id: true, userId: true, kind: true, dedupeKey: true },
  });

  await enqueueForNotifications(tx, inserted);
  return inserted.length;
}

/**
 * Tells every seller who holds one of a request's tags that it exists.
 *
 * Deliberately ONE set-based statement rather than a JS loop: a popular tag can
 * hold hundreds of sellers, and loading them into Node to insert one at a time
 * would be both slow and a memory cliff. The filters live in SQL for the same
 * reason.
 *
 * Excluded: paused sellers, suspended sellers, the buyer themselves, anyone
 * with a block in either direction, and anyone who already has a row for this
 * request.
 */
export async function fanOutOpenRequest(
  tx: Tx,
  params: { requestId: string; buyerUserId: string; tagIds: string[] },
): Promise<number> {
  if (params.tagIds.length === 0) return 0;

  // Timestamps are bound from JS rather than `now()`: Prisma stores DateTime
  // as naive UTC, and `now()` renders in the session time zone.
  const now = new Date();

  const notified = await tx.$executeRaw(Prisma.sql`
    INSERT INTO "Notification" ("id", "userId", "kind", "requestId", "actorUserId", "dedupeKey", "createdAt")
    SELECT
      gen_random_uuid()::text,
      st."sellerUserId",
      'OPEN_REQUEST_IN_TAG'::"NotificationKind",
      ${params.requestId},
      ${params.buyerUserId},
      ${"open_req:" + params.requestId},
      ${now}
    FROM "SellerTag" st
    JOIN "SellerProfile" sp ON sp."userId" = st."sellerUserId"
    JOIN "User" u ON u."id" = st."sellerUserId"
    WHERE st."tagId" IN (${Prisma.join(params.tagIds)})
      AND sp."isAvailable"                        -- paused sellers get no new requests
      AND u."status" = 'ACTIVE'::"UserStatus"     -- nor do suspended ones
      AND st."sellerUserId" <> ${params.buyerUserId}  -- never notify the buyer about their own request
      AND ${notBlockedSql(params.buyerUserId, Prisma.sql`st."sellerUserId"`)}
    ON CONFLICT ("userId", "dedupeKey") DO NOTHING
  `);

  // One DIGEST email per recipient per day, set-based for the same reason.
  if (notified > 0) await enqueueDigestsForNotificationKey(tx, "open_req:" + params.requestId, now);

  return notified;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}
