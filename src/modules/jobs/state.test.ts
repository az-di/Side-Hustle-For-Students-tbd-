import { describe, expect, it } from "vitest";
import {
  applyJobEvent,
  effectiveJobStatus,
  isReviewable,
  type JobStateView,
} from "./state";

const NOW = new Date("2030-01-10T12:00:00Z");
const PAST = new Date("2030-01-09T12:00:00Z");
const FUTURE = new Date("2030-01-17T12:00:00Z");

const BUYER = "user_buyer";
const SELLER = "user_seller";
const STRANGER = "user_stranger";

function job(overrides: Partial<JobStateView> = {}): JobStateView {
  return {
    status: "IN_PROGRESS",
    buyerUserId: BUYER,
    sellerUserId: SELLER,
    completionRequestedById: null,
    autoCompleteAt: null,
    ...overrides,
  };
}

const withDialogue = (userId: string) => ({ userId, threadHasDialogue: true });

describe("marking complete", () => {
  it("can be done by either party", () => {
    expect(applyJobEvent(job(), "MARK_COMPLETE", withDialogue(BUYER), NOW)).toMatchObject({
      ok: true,
      to: "AWAITING_CONFIRMATION",
    });
    expect(applyJobEvent(job(), "MARK_COMPLETE", withDialogue(SELLER), NOW)).toMatchObject({
      ok: true,
      to: "AWAITING_CONFIRMATION",
    });
  });

  it("cannot be done by someone who is not on the job", () => {
    expect(applyJobEvent(job(), "MARK_COMPLETE", withDialogue(STRANGER), NOW)).toMatchObject({
      ok: false,
      reason: "NOT_A_PARTY",
    });
  });

  it("requires that both people have actually spoken", () => {
    // Without this, anyone could mark a dead job complete and wait out the
    // auto-complete window to manufacture a completed job and a review slot.
    expect(applyJobEvent(job(), "MARK_COMPLETE", { userId: BUYER, threadHasDialogue: false }, NOW)).toMatchObject({
      ok: false,
      reason: "NO_DIALOGUE_YET",
    });
  });
});

describe("confirming completion", () => {
  const awaiting = job({
    status: "AWAITING_CONFIRMATION",
    completionRequestedById: SELLER,
    autoCompleteAt: FUTURE,
  });

  it("is done by the other party", () => {
    expect(applyJobEvent(awaiting, "CONFIRM_COMPLETE", { userId: BUYER }, NOW)).toMatchObject({
      ok: true,
      to: "COMPLETED",
    });
  });

  it("cannot be done by whoever marked it complete", () => {
    expect(applyJobEvent(awaiting, "CONFIRM_COMPLETE", { userId: SELLER }, NOW)).toMatchObject({
      ok: false,
      reason: "MUST_BE_OTHER_PARTY",
    });
  });

  it("can be rejected by the other party, reopening the job", () => {
    expect(applyJobEvent(awaiting, "REJECT_COMPLETION", { userId: BUYER }, NOW)).toMatchObject({
      ok: true,
      to: "IN_PROGRESS",
    });
  });
});

describe("auto-completion", () => {
  const due = job({ status: "AWAITING_CONFIRMATION", completionRequestedById: SELLER, autoCompleteAt: PAST });
  const notDue = job({ status: "AWAITING_CONFIRMATION", completionRequestedById: SELLER, autoCompleteAt: FUTURE });

  it("fires only once the window has passed", () => {
    expect(applyJobEvent(due, "AUTO_COMPLETE", { userId: "system", isSystem: true }, NOW)).toMatchObject({
      ok: true,
      to: "COMPLETED",
    });
    expect(applyJobEvent(notDue, "AUTO_COMPLETE", { userId: "system", isSystem: true }, NOW)).toMatchObject({
      ok: false,
      reason: "AUTO_NOT_DUE",
    });
  });

  it("cannot be triggered by a party pretending to be the system", () => {
    expect(applyJobEvent(due, "AUTO_COMPLETE", { userId: BUYER }, NOW)).toMatchObject({
      ok: false,
      reason: "NOT_A_PARTY",
    });
  });

  it("reads as completed with no sweep having run", () => {
    expect(effectiveJobStatus(due, NOW)).toBe("COMPLETED");
    expect(effectiveJobStatus(notDue, NOW)).toBe("AWAITING_CONFIRMATION");
  });

  it("unlocks the review even before the status is written down", () => {
    expect(isReviewable(due, NOW)).toBe(true);
    expect(isReviewable(notDue, NOW)).toBe(false);
    expect(isReviewable(job(), NOW)).toBe(false);
  });
});

describe("terminal jobs", () => {
  it("refuse everything", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      for (const event of ["MARK_COMPLETE", "CONFIRM_COMPLETE", "REJECT_COMPLETION", "AUTO_COMPLETE", "CANCEL"] as const) {
        expect(
          applyJobEvent(job({ status }), event, { userId: BUYER, isSystem: true, threadHasDialogue: true }, NOW),
          `${status} + ${event}`,
        ).toMatchObject({ ok: false, reason: "TERMINAL" });
      }
    }
  });
});
