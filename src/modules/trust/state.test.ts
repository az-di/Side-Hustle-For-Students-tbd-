import { describe, expect, it } from "vitest";
import { REPORT_WEIGHTS, canAct, evaluateTrust, isBlockedPair, negativeWeight } from "./state";

describe("negativeWeight", () => {
  it("sums only reports that still count", () => {
    expect(
      negativeWeight([
        { status: "OPEN", weight: 1 },
        { status: "UPHELD", weight: 2 },
        { status: "DISMISSED", weight: 3 },
      ]),
    ).toBe(3);
  });

  it("is zero with nothing on file", () => {
    expect(negativeWeight([])).toBe(0);
  });

  it("weights a scam report more than a no-show", () => {
    expect(REPORT_WEIGHTS.SCAM).toBeGreaterThan(REPORT_WEIGHTS.NO_SHOW);
  });
});

describe("evaluateTrust", () => {
  it("suspends an active account at the threshold", () => {
    expect(evaluateTrust({ status: "ACTIVE", weight: 3, threshold: 3, autoSuspended: false })).toMatchObject({
      action: "SUSPEND",
    });
  });

  it("leaves an active account under the threshold alone", () => {
    expect(evaluateTrust({ status: "ACTIVE", weight: 2, threshold: 3, autoSuspended: false })).toEqual({
      action: "NONE",
    });
  });

  it("reinstates an auto-suspended account once reports are dismissed", () => {
    expect(evaluateTrust({ status: "SUSPENDED", weight: 1, threshold: 3, autoSuspended: true })).toEqual({
      action: "REINSTATE",
    });
  });

  it("never reinstates an admin suspension by itself", () => {
    expect(evaluateTrust({ status: "SUSPENDED", weight: 0, threshold: 3, autoSuspended: false })).toEqual({
      action: "NONE",
    });
  });

  it("never touches a closed account", () => {
    expect(evaluateTrust({ status: "CLOSED", weight: 99, threshold: 3, autoSuspended: false })).toEqual({
      action: "NONE",
    });
    expect(evaluateTrust({ status: "CLOSED", weight: 0, threshold: 3, autoSuspended: true })).toEqual({
      action: "NONE",
    });
  });
});

describe("canAct", () => {
  it("only an active account may act", () => {
    expect(canAct("ACTIVE")).toBe(true);
    expect(canAct("SUSPENDED")).toBe(false);
    expect(canAct("CLOSED")).toBe(false);
  });
});

describe("isBlockedPair", () => {
  const blocks = [{ blockerUserId: "a", blockedUserId: "b" }];

  it("is symmetric", () => {
    expect(isBlockedPair(blocks, "a", "b")).toBe(true);
    expect(isBlockedPair(blocks, "b", "a")).toBe(true);
  });

  it("does not match an unrelated pair", () => {
    expect(isBlockedPair(blocks, "a", "c")).toBe(false);
  });
});
