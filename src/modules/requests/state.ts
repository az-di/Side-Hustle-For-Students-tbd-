import type { RequestKind, RequestStatus } from "@/generated/prisma/enums";

/**
 * The request lifecycle, as a table plus one pure function.
 *
 * Nothing here touches the database or the clock: `applyRequestEvent` is given
 * the row, the event, who is asking and what time it is, and answers whether
 * the move is legal. That makes every rule in the spec testable in
 * milliseconds, and keeps authorization next to the transition it guards
 * instead of scattered through server actions.
 */

export type RequestEvent =
  | "SELLER_ACCEPT"
  | "SELLER_DECLINE"
  | "SELLER_RESPOND"
  | "BUYER_SELECT"
  | "BUYER_CANCEL"
  | "EXPIRE";

/** Who is allowed to fire a transition, relative to the request. */
export type ActorRole = "BUYER" | "TARGET_SELLER" | "SELLER" | "SYSTEM";

type Transition = {
  to: RequestStatus;
  actor: ActorRole;
  /** OPEN requests collect responses without changing status. */
  staysOpen?: boolean;
};

export const REQUEST_TRANSITIONS: Partial<Record<RequestStatus, Partial<Record<RequestEvent, Transition>>>> = {
  PENDING_SELLER: {
    SELLER_ACCEPT: { to: "MATCHED", actor: "TARGET_SELLER" },
    SELLER_DECLINE: { to: "DECLINED", actor: "TARGET_SELLER" },
    BUYER_CANCEL: { to: "CANCELLED", actor: "BUYER" },
    EXPIRE: { to: "EXPIRED", actor: "SYSTEM" },
  },
  OPEN: {
    SELLER_RESPOND: { to: "OPEN", actor: "SELLER", staysOpen: true },
    BUYER_SELECT: { to: "MATCHED", actor: "BUYER" },
    BUYER_CANCEL: { to: "CANCELLED", actor: "BUYER" },
    EXPIRE: { to: "EXPIRED", actor: "SYSTEM" },
  },
  // MATCHED, DECLINED, EXPIRED and CANCELLED are terminal.
};

export const TERMINAL_REQUEST_STATUSES: RequestStatus[] = ["MATCHED", "DECLINED", "EXPIRED", "CANCELLED"];

export type RequestDenialReason =
  | "TERMINAL"
  | "NOT_ALLOWED_FOR_STATUS"
  | "WRONG_ACTOR"
  | "EXPIRED"
  | "NOT_OPEN_KIND"
  | "ALREADY_RESPONDED"
  | "SELLER_PAUSED"
  | "OWN_REQUEST";

export type RequestDecision =
  | { ok: true; to: RequestStatus; staysOpen: boolean }
  | { ok: false; reason: RequestDenialReason; message: string };

const DENIAL_MESSAGES: Record<RequestDenialReason, string> = {
  TERMINAL: "This request is already closed.",
  NOT_ALLOWED_FOR_STATUS: "That is not possible for this request right now.",
  WRONG_ACTOR: "You are not allowed to do that on this request.",
  EXPIRED: "This request has expired.",
  NOT_OPEN_KIND: "That only applies to open requests.",
  ALREADY_RESPONDED: "You have already responded to this request.",
  SELLER_PAUSED: "You are paused, so you are not receiving new work. Resume to respond.",
  OWN_REQUEST: "You cannot respond to your own request.",
};

function deny(reason: RequestDenialReason): RequestDecision {
  return { ok: false, reason, message: DENIAL_MESSAGES[reason] };
}

export type RequestStateView = {
  status: RequestStatus;
  kind: RequestKind;
  buyerUserId: string;
  targetSellerUserId: string | null;
  expiresAt: Date;
};

export type ActorView = {
  userId: string;
  /** Only relevant to SELLER_RESPOND. */
  isAvailableSeller?: boolean;
  hasResponded?: boolean;
  isSystem?: boolean;
};

/**
 * Decides whether `event` may be applied. Pure: no I/O, no Date.now().
 */
export function applyRequestEvent(
  request: RequestStateView,
  event: RequestEvent,
  actor: ActorView,
  now: Date,
): RequestDecision {
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) return deny("TERMINAL");

  // Checked before the table lookup purely for the error message: responding to
  // a direct request is a kind mismatch, and telling the seller that is more
  // useful than the generic "not possible right now".
  if (event === "SELLER_RESPOND" && request.kind !== "OPEN") return deny("NOT_OPEN_KIND");

  const transition = REQUEST_TRANSITIONS[request.status]?.[event];
  if (!transition) return deny("NOT_ALLOWED_FOR_STATUS");

  // Expiry beats everything except the expiry event itself: a request whose
  // deadline has passed cannot be accepted or responded to, whether or not a
  // sweep has gotten around to marking it.
  const hasExpired = request.expiresAt.getTime() <= now.getTime();
  if (hasExpired && event !== "EXPIRE") return deny("EXPIRED");

  switch (transition.actor) {
    case "SYSTEM":
      if (!actor.isSystem) return deny("WRONG_ACTOR");
      break;
    case "BUYER":
      if (actor.userId !== request.buyerUserId) return deny("WRONG_ACTOR");
      break;
    case "TARGET_SELLER":
      if (actor.userId !== request.targetSellerUserId) return deny("WRONG_ACTOR");
      break;
    case "SELLER":
      if (request.kind !== "OPEN") return deny("NOT_OPEN_KIND");
      if (actor.userId === request.buyerUserId) return deny("OWN_REQUEST");
      if (actor.isAvailableSeller === false) return deny("SELLER_PAUSED");
      if (actor.hasResponded) return deny("ALREADY_RESPONDED");
      break;
  }

  return { ok: true, to: transition.to, staysOpen: transition.staysOpen ?? false };
}

/**
 * Expiry is DERIVED, not scheduled.
 *
 * There is no cron in this build: a request whose deadline has passed reads as
 * EXPIRED immediately, and every seller-facing feed query filters on
 * `expiresAt > now()`. The stored status catches up whenever someone opens the
 * request. That is strictly better than a sweep for correctness — the sweep
 * would only ever be about notification timeliness.
 */
export function effectiveRequestStatus(
  request: { status: RequestStatus; expiresAt: Date },
  now: Date = new Date(),
): RequestStatus {
  const live = request.status === "OPEN" || request.status === "PENDING_SELLER";
  if (live && request.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return request.status;
}

export function isRequestLive(request: { status: RequestStatus; expiresAt: Date }, now: Date = new Date()): boolean {
  const effective = effectiveRequestStatus(request, now);
  return effective === "OPEN" || effective === "PENDING_SELLER";
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING_SELLER: "Waiting on seller",
  OPEN: "Open for responses",
  MATCHED: "Matched",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
