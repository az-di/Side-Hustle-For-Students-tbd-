import { describe, expect, it } from "vitest";
import type { RequestStatus } from "@/generated/prisma/enums";
import {
  REQUEST_TRANSITIONS,
  TERMINAL_REQUEST_STATUSES,
  applyRequestEvent,
  effectiveRequestStatus,
  type ActorView,
  type RequestEvent,
  type RequestStateView,
} from "./state";

const NOW = new Date("2030-01-01T12:00:00Z");
const LATER = new Date("2030-01-05T12:00:00Z");
const EARLIER = new Date("2029-12-30T12:00:00Z");

const BUYER = "user_buyer";
const TARGET = "user_target_seller";
const OTHER_SELLER = "user_other_seller";

function openRequest(overrides: Partial<RequestStateView> = {}): RequestStateView {
  return {
    status: "OPEN",
    kind: "OPEN",
    buyerUserId: BUYER,
    targetSellerUserId: null,
    expiresAt: LATER,
    ...overrides,
  };
}

function directRequest(overrides: Partial<RequestStateView> = {}): RequestStateView {
  return {
    status: "PENDING_SELLER",
    kind: "DIRECT",
    buyerUserId: BUYER,
    targetSellerUserId: TARGET,
    expiresAt: LATER,
    ...overrides,
  };
}

const seller: ActorView = { userId: OTHER_SELLER, isAvailableSeller: true, hasResponded: false };

describe("direct requests", () => {
  it("lets the targeted seller accept or decline", () => {
    expect(applyRequestEvent(directRequest(), "SELLER_ACCEPT", { userId: TARGET }, NOW)).toMatchObject({
      ok: true,
      to: "MATCHED",
    });
    expect(applyRequestEvent(directRequest(), "SELLER_DECLINE", { userId: TARGET }, NOW)).toMatchObject({
      ok: true,
      to: "DECLINED",
    });
  });

  it("does not let a different seller accept someone else's direct request", () => {
    const decision = applyRequestEvent(directRequest(), "SELLER_ACCEPT", { userId: OTHER_SELLER }, NOW);
    expect(decision).toMatchObject({ ok: false, reason: "WRONG_ACTOR" });
  });

  it("does not let the buyer accept on the seller's behalf", () => {
    expect(applyRequestEvent(directRequest(), "SELLER_ACCEPT", { userId: BUYER }, NOW)).toMatchObject({
      ok: false,
      reason: "WRONG_ACTOR",
    });
  });

  it("lets the buyer cancel while it is still pending", () => {
    expect(applyRequestEvent(directRequest(), "BUYER_CANCEL", { userId: BUYER }, NOW)).toMatchObject({
      ok: true,
      to: "CANCELLED",
    });
  });

  it("rejects SELLER_RESPOND, which only applies to open requests", () => {
    expect(applyRequestEvent(directRequest(), "SELLER_RESPOND", seller, NOW)).toMatchObject({
      ok: false,
      reason: "NOT_OPEN_KIND",
    });
  });
});

describe("open requests", () => {
  it("accepts a response from an available seller and stays open", () => {
    const decision = applyRequestEvent(openRequest(), "SELLER_RESPOND", seller, NOW);
    expect(decision).toMatchObject({ ok: true, to: "OPEN", staysOpen: true });
  });

  it("refuses a second response from the same seller", () => {
    const decision = applyRequestEvent(openRequest(), "SELLER_RESPOND", { ...seller, hasResponded: true }, NOW);
    expect(decision).toMatchObject({ ok: false, reason: "ALREADY_RESPONDED" });
  });

  it("refuses a paused seller — pause means no new work", () => {
    const decision = applyRequestEvent(openRequest(), "SELLER_RESPOND", { ...seller, isAvailableSeller: false }, NOW);
    expect(decision).toMatchObject({ ok: false, reason: "SELLER_PAUSED" });
  });

  it("refuses the buyer responding to their own request", () => {
    const decision = applyRequestEvent(openRequest(), "SELLER_RESPOND", { userId: BUYER }, NOW);
    expect(decision).toMatchObject({ ok: false, reason: "OWN_REQUEST" });
  });

  it("lets only the buyer select a winner", () => {
    expect(applyRequestEvent(openRequest(), "BUYER_SELECT", { userId: BUYER }, NOW)).toMatchObject({
      ok: true,
      to: "MATCHED",
    });
    expect(applyRequestEvent(openRequest(), "BUYER_SELECT", seller, NOW)).toMatchObject({
      ok: false,
      reason: "WRONG_ACTOR",
    });
  });
});

describe("expiry", () => {
  it("blocks every event except EXPIRE once the deadline has passed", () => {
    const stale = openRequest({ expiresAt: EARLIER });
    expect(applyRequestEvent(stale, "SELLER_RESPOND", seller, NOW)).toMatchObject({ ok: false, reason: "EXPIRED" });
    expect(applyRequestEvent(stale, "BUYER_SELECT", { userId: BUYER }, NOW)).toMatchObject({
      ok: false,
      reason: "EXPIRED",
    });
    expect(applyRequestEvent(stale, "EXPIRE", { userId: "system", isSystem: true }, NOW)).toMatchObject({
      ok: true,
      to: "EXPIRED",
    });
  });

  it("only the system may fire EXPIRE", () => {
    const stale = openRequest({ expiresAt: EARLIER });
    expect(applyRequestEvent(stale, "EXPIRE", { userId: BUYER }, NOW)).toMatchObject({
      ok: false,
      reason: "WRONG_ACTOR",
    });
  });

  it("reads as expired without any sweep having run", () => {
    expect(effectiveRequestStatus({ status: "OPEN", expiresAt: EARLIER }, NOW)).toBe("EXPIRED");
    expect(effectiveRequestStatus({ status: "PENDING_SELLER", expiresAt: EARLIER }, NOW)).toBe("EXPIRED");
  });

  it("does not rewrite a terminal status just because time passed", () => {
    expect(effectiveRequestStatus({ status: "MATCHED", expiresAt: EARLIER }, NOW)).toBe("MATCHED");
    expect(effectiveRequestStatus({ status: "CANCELLED", expiresAt: EARLIER }, NOW)).toBe("CANCELLED");
  });
});

describe("terminal states", () => {
  it("refuses every event", () => {
    const events: RequestEvent[] = [
      "SELLER_ACCEPT",
      "SELLER_DECLINE",
      "SELLER_RESPOND",
      "BUYER_SELECT",
      "BUYER_CANCEL",
      "EXPIRE",
    ];

    for (const status of TERMINAL_REQUEST_STATUSES) {
      for (const event of events) {
        const decision = applyRequestEvent(openRequest({ status }), event, { userId: BUYER, isSystem: true }, NOW);
        expect(decision, `${status} + ${event} must be refused`).toMatchObject({ ok: false, reason: "TERMINAL" });
      }
    }
  });
});

describe("the transition table itself", () => {
  // Adding a status to the enum without deciding its transitions should fail
  // here rather than silently behave as "nothing is allowed".
  it("covers every status either as live or as explicitly terminal", () => {
    const all: RequestStatus[] = ["PENDING_SELLER", "OPEN", "MATCHED", "DECLINED", "EXPIRED", "CANCELLED"];
    for (const status of all) {
      const isLive = Object.keys(REQUEST_TRANSITIONS[status] ?? {}).length > 0;
      const isTerminal = TERMINAL_REQUEST_STATUSES.includes(status);
      expect(isLive !== isTerminal, `${status} must be either live or terminal, not both or neither`).toBe(true);
    }
  });
});
