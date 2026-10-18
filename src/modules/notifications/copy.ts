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

export type NotificationContext = { actor: string; title: string; tagName: string };

export const NOTIFICATION_COPY: Record<NotificationKind, (c: NotificationContext) => string> = {
  DIRECT_REQUEST_RECEIVED: (c) => `${c.actor} asked you directly`,
  OPEN_REQUEST_IN_TAG: (c) => `New request in your tags: ${c.title}`,
  RESPONSE_RECEIVED: (c) => `${c.actor} responded to your request`,
  RESPONSE_SELECTED: (c) => `${c.actor} picked you — the job is on`,
  RESPONSE_NOT_SELECTED: (c) => `Not picked for ${c.title}`,
  REQUEST_DECLINED: (c) => `${c.actor} declined your request`,
  REQUEST_CANCELLED: (c) => `${c.actor} cancelled their request`,
  REQUEST_EXPIRED: (c) => `Your request expired: ${c.title}`,
  JOB_STARTED: (c) => `${c.actor} accepted — the job has started`,
  COMPLETION_REQUESTED: (c) => `${c.actor} marked the job complete — confirm it`,
  JOB_COMPLETED: (c) => `Job complete: ${c.title}`,
  JOB_AUTO_COMPLETED: (c) => `Auto-confirmed after the waiting period: ${c.title}`,
  JOB_CANCELLED: (c) => `${c.actor} cancelled the job`,
  REVIEW_RECEIVED: (c) => `${c.actor} left you a review`,
  MESSAGE_RECEIVED: (c) => `${c.actor} sent you a message`,
  SELLER_OPEN_TO_TAG: (c) => `${c.actor} is now open to ${c.tagName} — you asked for that recently`,
};

/** The strings a row needs, from its relations. Both consumers use this so the fallbacks agree. */
export function notificationContext(n: {
  actor: { displayName: string } | null;
  request: { title: string } | null;
  job?: { request: { title: string } } | null;
  tag: { name: string } | null;
}): NotificationContext {
  return {
    actor: n.actor?.displayName ?? "Someone",
    title: n.request?.title ?? n.job?.request.title ?? "a request",
    tagName: n.tag?.name ?? "a tag",
  };
}

/** Where a notification links to. Jobs win over threads win over requests; tag alerts go to search. */
export function notificationHref(n: {
  jobId: string | null;
  threadId: string | null;
  requestId: string | null;
  tag?: { slug: string } | null;
}): string {
  if (n.jobId) return `/jobs/${n.jobId}`;
  if (n.threadId) return `/threads/${n.threadId}`;
  if (n.requestId) return `/requests/${n.requestId}`;
  if (n.tag) return `/search?tag=${n.tag.slug}`;
  return "/";
}
