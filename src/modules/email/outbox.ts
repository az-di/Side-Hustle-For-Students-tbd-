import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import type { Tx } from "@/lib/tx";
import { DIGEST_DELAY_MS, digestBucket, digestDedupeKey, digestSince, immediateDedupeKey, nextAttemptAt, planFor } from "./state";
import { renderOutboxRow, unsubscribeUrl } from "./templates";

/**
 * The outbox.
 *
 *   enqueue — called inside the transaction that writes a Notification, so
 *             "state changed" and "email owed" commit together or not at all
 *   drain   — claims due rows with SKIP LOCKED (safe to run from several
 *             processes), renders each for its recipient, sends, and marks
 *             the row. A failed send backs off; a recipient who opted out is
 *             SKIPPED, not retried.
 */

export type EnqueueInput = {
  userId: string;
  template: "notification" | "digest";
  payload: Record<string, unknown>;
  dedupeKey: string;
  sendAfter?: Date;
};

export async function enqueueEmail(tx: Tx, rows: EnqueueInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await tx.outboundEmail.createMany({
    data: rows.map((r) => ({
      userId: r.userId,
      template: r.template,
      payload: r.payload as Prisma.InputJsonValue,
      dedupeKey: r.dedupeKey,
      sendAfter: r.sendAfter ?? new Date(),
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Queues the email owed for freshly written notifications. Called by
 * notify() so no mutation has to remember to do it.
 */
export async function enqueueForNotifications(
  tx: Tx,
  notifications: { id: string; userId: string; kind: Parameters<typeof planFor>[0]; dedupeKey: string }[],
  now: Date = new Date(),
): Promise<number> {
  const rows: EnqueueInput[] = [];
  for (const n of notifications) {
    const plan = planFor(n.kind, now);
    if (plan.mode === "IMMEDIATE") {
      rows.push({
        userId: n.userId,
        template: "notification",
        payload: { notificationId: n.id },
        dedupeKey: immediateDedupeKey(n.dedupeKey, n.userId),
      });
    } else if (plan.mode === "DIGEST") {
      rows.push({
        userId: n.userId,
        template: "digest",
        payload: { since: digestSince(plan.bucket).toISOString() },
        dedupeKey: digestDedupeKey(n.userId, plan.bucket),
        sendAfter: plan.sendAfter,
      });
    }
  }
  return enqueueEmail(tx, rows);
}

/**
 * The set-based twin of enqueueForNotifications, for notifications written by
 * a raw INSERT … SELECT (the open-request fan-out, the watched-tag alert):
 * one DIGEST row per recipient of `notificationDedupeKey`, per day. The
 * conflict target is the digest key, so a second event on the same day adds
 * nothing — the digest renders whatever is unread at send time.
 *
 * Timestamps are bound from JS, never `now()`: Prisma stores DateTime as naive
 * UTC and `now()` renders in the session time zone.
 */
export async function enqueueDigestsForNotificationKey(tx: Tx, notificationDedupeKey: string, now = new Date()): Promise<number> {
  const bucket = digestBucket(now);
  const sendAfter = new Date(now.getTime() + DIGEST_DELAY_MS);
  return tx.$executeRaw(Prisma.sql`
    INSERT INTO "OutboundEmail" ("id", "userId", "template", "payload", "dedupeKey", "sendAfter", "createdAt")
    SELECT
      gen_random_uuid()::text,
      n."userId",
      'digest',
      jsonb_build_object('since', ${digestSince(bucket).toISOString()}::text),
      ${"digest:"} || n."userId" || ${":" + bucket},
      ${sendAfter},
      ${now}
    FROM "Notification" n
    JOIN "User" u ON u."id" = n."userId"
    WHERE n."dedupeKey" = ${notificationDedupeKey}
      AND NOT u."emailOptOut"
    ON CONFLICT ("dedupeKey") DO NOTHING
  `);
}

type Claimed = { id: string; userId: string; template: string; payload: unknown; attempts: number };

/**
 * Sends everything that is due. Returns counts for logging. Never throws:
 * one bad row must not stop the rest.
 */
export async function drainOutbox(limit = 50): Promise<{ sent: number; skipped: number; failed: number; retried: number }> {
  const tally = { sent: 0, skipped: 0, failed: 0, retried: 0 };

  // Claim atomically. The attempts bump is what stops two drains sending the
  // same row: a second claimant sees the row locked, skips it, and by the time
  // it is unlocked the status has changed.
  //
  // The clock is bound from JS, never `now()`: Prisma stores DateTime as a
  // naive UTC timestamp, and Postgres `now()` renders in the session's time
  // zone, so comparing the two is wrong by the UTC offset on any box not set
  // to UTC.
  const now = new Date();
  const claimed = await db.$queryRaw<Claimed[]>(Prisma.sql`
    UPDATE "OutboundEmail" o
    SET "attempts" = o."attempts" + 1
    WHERE o."id" IN (
      SELECT "id" FROM "OutboundEmail"
      WHERE "status" = 'PENDING' AND "sendAfter" <= ${now}
      ORDER BY "sendAfter"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING o."id", o."userId", o."template", o."payload", o."attempts"
  `);

  for (const row of claimed) {
    try {
      const recipient = await db.user.findUnique({
        where: { id: row.userId },
        select: { id: true, uwEmail: true, emailOptOut: true, emailUnsubKey: true, status: true },
      });

      if (!recipient || recipient.emailOptOut || recipient.status === "CLOSED") {
        await db.outboundEmail.update({ where: { id: row.id }, data: { status: "SKIPPED" } });
        tally.skipped++;
        continue;
      }

      const rendered = await renderOutboxRow(db, row, recipient);
      if (!rendered) {
        await db.outboundEmail.update({ where: { id: row.id }, data: { status: "SKIPPED" } });
        tally.skipped++;
        continue;
      }

      const unsub = unsubscribeUrl(recipient);
      const result = await sendEmail({
        to: recipient.uwEmail,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      // "console" delivery is a success for the outbox's purposes: the row was
      // handed to the configured transport, and retrying would only re-log it.
      if (result.delivered || result.via === "console") {
        await db.outboundEmail.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
        tally.sent++;
        continue;
      }

      await scheduleRetry(row, result.error ?? "send failed", tally);
    } catch (err) {
      await scheduleRetry(row, err instanceof Error ? err.message : String(err), tally).catch(() => {});
    }
  }

  return tally;
}

async function scheduleRetry(row: Claimed, error: string, tally: { failed: number; retried: number }): Promise<void> {
  const next = nextAttemptAt(row.attempts, new Date());
  if (next === null) {
    await db.outboundEmail.update({ where: { id: row.id }, data: { status: "FAILED", lastError: error } });
    tally.failed++;
  } else {
    await db.outboundEmail.update({ where: { id: row.id }, data: { sendAfter: next, lastError: error } });
    tally.retried++;
  }
}
