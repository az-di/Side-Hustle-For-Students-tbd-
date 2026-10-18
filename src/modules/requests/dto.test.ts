import { describe, expect, it } from "vitest";
import { toBuyerRequest, toSellerRequest, type RequestRow } from "./dto";

/**
 * THE LEAK SUITE.
 *
 * If this file fails, a seller can see what the buyer was willing to pay, and
 * the central claim of the product is false. It is deliberately blunt: take a
 * row with a distinctive gross figure, serialize the seller DTO, and assert the
 * number does not appear anywhere in it — in any field, under any name.
 *
 * Add a new seller-facing mapper? Add it here too.
 */

const GROSS_FIXED = 10_000; // $100 ceiling
const GROSS_HOURLY = 5_000; // $50/hr ceiling
const NET_FIXED = 9_000; // $90 payout
const NET_HOURLY = 4_500; // $45/hr payout

const row: RequestRow = {
  id: "req_1",
  kind: "OPEN",
  status: "OPEN",
  title: "Photographer for our winter banquet",
  details: "Two hours, 60 people, indoor evening lighting.",
  grossFixedBudgetCents: GROSS_FIXED,
  grossHourlyBudgetCents: GROSS_HOURLY,
  feeBps: 1000,
  expiresAt: new Date("2030-01-01T00:00:00Z"),
  createdAt: new Date("2029-12-01T00:00:00Z"),
  buyerUserId: "user_buyer",
  targetSellerUserId: null,
  chosenResponseId: null,
  buyer: { handle: "alexkim", displayName: "Alex Kim" },
  tags: [{ tag: { id: "tag_1", name: "Photography", slug: "photography", kind: "SERVICE" } }],
};

describe("toSellerRequest", () => {
  const dto = toSellerRequest(row);
  const serialized = JSON.stringify(dto);

  it("shows the seller their payout, not the buyer's budget", () => {
    expect(dto.payoutFixedCents).toBe(NET_FIXED);
    expect(dto.payoutHourlyCents).toBe(NET_HOURLY);
  });

  it("never contains the gross figure in any form", () => {
    expect(serialized).not.toContain(String(GROSS_FIXED));
    expect(serialized).not.toContain(String(GROSS_HOURLY));
    expect(serialized).not.toContain("100.00");
    expect(serialized).not.toContain("$100");
  });

  it("has no gross-shaped key at all, so there is nowhere to put one", () => {
    const keys = Object.keys(dto).join(",").toLowerCase();
    expect(keys).not.toMatch(/gross/);
    expect(keys).not.toMatch(/budget/);
    expect(keys).not.toMatch(/\bfee/);
  });

  it("does not leak the gross through a nested object either", () => {
    // Walks every value in the serialized tree, not just top-level keys.
    const seen: number[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "number") seen.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(dto);
    expect(seen).not.toContain(GROSS_FIXED);
    expect(seen).not.toContain(GROSS_HOURLY);
  });

  it("marks an expired request as expired without a sweep having run", () => {
    const expired = toSellerRequest(
      { ...row, expiresAt: new Date("2020-01-01T00:00:00Z") },
      new Date("2030-06-01T00:00:00Z"),
    );
    expect(expired.effectiveStatus).toBe("EXPIRED");
  });
});

describe("toBuyerRequest", () => {
  const dto = toBuyerRequest(row);

  it("shows the buyer both numbers, because they pay the net one", () => {
    expect(dto.budgetFixedCents).toBe(GROSS_FIXED);
    expect(dto.sellerSeesFixedCents).toBe(NET_FIXED);
    expect(dto.budgetHourlyCents).toBe(GROSS_HOURLY);
    expect(dto.sellerSeesHourlyCents).toBe(NET_HOURLY);
  });

  it("carries the fee rate that was frozen on the row", () => {
    expect(dto.feeBps).toBe(1000);
  });

  it("respects a per-row fee of zero (the beta waiver)", () => {
    const waived = toBuyerRequest({ ...row, feeBps: 0 });
    expect(waived.sellerSeesFixedCents).toBe(GROSS_FIXED);
    expect(toSellerRequest({ ...row, feeBps: 0 }).payoutFixedCents).toBe(GROSS_FIXED);
  });
});
