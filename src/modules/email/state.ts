import type { NotificationKind } from "@/generated/prisma/enums";

/**
 * Email rules, pure. Which notifications email at all, which are digested,
 * how retries back off.
 */

/** Hard ceiling before a row is marked FAILED. 1 + 5 retries ≈ 1 hour of backoff. */
export const MAX_ATTEMPTS = 6;

/** How long a digest waits after its first event, so several can collapse. */
export const DIGEST_DELAY_MS = 60 * 60 * 1000;

/**
 * Fan-out kinds are DIGESTED: one open request in a popular tag is hundreds
 * of emails, and Resend's free tier is ~100/day. They collapse into one
 * "N new requests in your tags" message, at most one per user per bucket.
 * 1:1 events stay immediate.
 */
export const DIGEST_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  "OPEN_REQUEST_IN_TAG",
  "SELLER_OPEN_TO_TAG",
]);

/** Kinds that are noisy enough in-app that email adds nothing. */
const NO_EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>(["RESPONSE_NOT_SELECTED"]);

export type EmailPlan =
  | { mode: "NONE" }
  | { mode: "IMMEDIATE" }
  | { mode: "DIGEST"; bucket: string; sendAfter: Date };

export function planFor(kind: NotificationKind, now: Date): EmailPlan {
  if (NO_EMAIL_KINDS.has(kind)) return { mode: "NONE" };
  if (DIGEST_KINDS.has(kind)) {
    return { mode: "DIGEST", bucket: digestBucket(now), sendAfter: new Date(now.getTime() + DIGEST_DELAY_MS) };
  }
  return { mode: "IMMEDIATE" };
}

/** One digest per user per UTC day. */
export function digestBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The digest renders everything unread since the bucket began, not since the
 * row was queued: the queuing clock (JS) and the notification's createdAt
 * (the transaction's DB clock) are not the same clock.
 */
export function digestSince(bucket: string): Date {
  return new Date(`${bucket}T00:00:00.000Z`);
}

export function digestDedupeKey(userId: string, bucket: string): string {
  return `digest:${userId}:${bucket}`;
}

export function immediateDedupeKey(notificationDedupeKey: string, userId: string): string {
  return `notif:${userId}:${notificationDedupeKey}`;
}

/**
 * Exponential backoff: 1, 2, 4, 8, 16 minutes. `attempts` is the count AFTER
 * the attempt that just failed.
 */
export function nextAttemptAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const minutes = 2 ** (attempts - 1);
  return new Date(now.getTime() + minutes * 60_000);
}
