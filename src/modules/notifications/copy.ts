import type { NotificationKind } from "@/generated/prisma/enums";

/**
 * Notification copy lives here, not in the database.
 *
 * Rows carry ids only — no rendered strings — precisely so that money can be
 * rendered per viewer. A stored string like "New request: $100 for photos"
 * would be role-blind and would ship the buyer's ceiling to every seller in
 * the tag. Nothing here shows an amount at all, which is also what makes the
 * same copy safe to reuse in email.
 */
export const NOTIFICATION_COPY: Record<NotificationKind, (actor: string, title: string) => string> = {
  DIRECT_REQUEST_RECEIVED: (actor) => `${actor} asked you directly`,
  OPEN_REQUEST_IN_TAG: (_actor, title) => `New request in your tags: ${title}`,
  RESPONSE_RECEIVED: (actor) => `${actor} responded to your request`,
  RESPONSE_SELECTED: (actor) => `${actor} picked you — the job is on`,
  RESPONSE_NOT_SELECTED: (_actor, title) => `Not picked for ${title}`,
  REQUEST_DECLINED: (actor) => `${actor} declined your request`,
  REQUEST_CANCELLED: (actor) => `${actor} cancelled their request`,
  REQUEST_EXPIRED: (_actor, title) => `Your request expired: ${title}`,
  JOB_STARTED: (actor) => `${actor} accepted — the job has started`,
  COMPLETION_REQUESTED: (actor) => `${actor} marked the job complete — confirm it`,
  JOB_COMPLETED: (_actor, title) => `Job complete: ${title}`,
  JOB_AUTO_COMPLETED: (_actor, title) => `Auto-confirmed after the waiting period: ${title}`,
  JOB_CANCELLED: (actor) => `${actor} cancelled the job`,
  REVIEW_RECEIVED: (actor) => `${actor} left you a review`,
  MESSAGE_RECEIVED: (actor) => `${actor} sent you a message`,
};

/** Where a notification links to. Jobs win over threads win over requests. */
export function notificationHref(n: { jobId: string | null; threadId: string | null; requestId: string | null }): string {
  return n.jobId ? `/jobs/${n.jobId}` : n.threadId ? `/threads/${n.threadId}` : n.requestId ? `/requests/${n.requestId}` : "/";
}
