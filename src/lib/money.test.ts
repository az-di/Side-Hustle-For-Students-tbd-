import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEE_BPS,
  feeFromGross,
  flatFitsHourly,
  formatCents,
  grossFromNet,
  netFromGross,
  parseDollarsToCents,
} from "./money";

describe("netFromGross", () => {
  it("takes 10% off the buyer's ceiling by default", () => {
    expect(netFromGross(10_000)).toBe(9_000); // $100 budget -> $90 payout
    expect(netFromGross(5_000)).toBe(4_500);
  });

  it("floors, so we never promise a cent that does not exist", () => {
    // 999 * 0.9 = 899.1 -> 899, not 900
    expect(netFromGross(999)).toBe(899);
  });

  it("is the identity when the fee is waived", () => {
    expect(netFromGross(12_345, 0)).toBe(12_345);
  });

  it("rejects anything that is not a non-negative integer of cents", () => {
    expect(() => netFromGross(10.5)).toThrow(/integer/);
    expect(() => netFromGross(-1)).toThrow(/negative/);
    expect(() => netFromGross(Number.NaN)).toThrow();
    expect(() => netFromGross(10_000, 10_000)).toThrow(/feeBps/); // a 100% fee is not a fee
  });
});

describe("grossFromNet / netFromGross round trip", () => {
  it("returns the seller's exact asking price", () => {
    // The property that justifies one function flooring and the other ceiling.
    for (const feeBps of [0, 1, 250, DEFAULT_FEE_BPS, 2_000, 5_000]) {
      for (const net of [0, 1, 7, 99, 100, 999, 1_234, 9_000, 50_000, 1_000_000]) {
        expect(netFromGross(grossFromNet(net, feeBps), feeBps)).toBe(net);
      }
    }
  });

  it("never asks a buyer to budget less than the seller receives", () => {
    for (const net of [1, 83, 2_500, 9_999]) {
      expect(grossFromNet(net)).toBeGreaterThanOrEqual(net);
    }
  });
});

describe("feeFromGross", () => {
  it("is the difference the platform would collect", () => {
    expect(feeFromGross(10_000)).toBe(1_000);
    expect(feeFromGross(10_000, 0)).toBe(0);
  });
});

describe("formatCents", () => {
  it("drops the cents when they are zero", () => {
    expect(formatCents(9_000)).toBe("$90");
    expect(formatCents(9_050)).toBe("$90.50");
    expect(formatCents(null)).toBe("—");
  });
});

describe("flatFitsHourly", () => {
  it("lets a one-hour job sit at the hourly rate", () => {
    expect(flatFitsHourly(4_000, 4_000)).toBe(true);
  });

  it("rejects a one-hour shoot that costs almost two hours of labor", () => {
    // $70 for ~an hour of photos + light edits, at $40/hr.
    expect(flatFitsHourly(7_000, 4_000)).toBe(false);
  });

  it("allows a little extra for editing on top of the hour", () => {
    expect(flatFitsHourly(6_000, 4_000)).toBe(true);
  });
});

describe("parseDollarsToCents", () => {
  it("accepts what a student would actually type", () => {
    expect(parseDollarsToCents("100")).toBe(10_000);
    expect(parseDollarsToCents("$100")).toBe(10_000);
    expect(parseDollarsToCents("1,200.50")).toBe(120_050);
    expect(parseDollarsToCents("")).toBeNull();
  });

  it("rejects junk", () => {
    expect(() => parseDollarsToCents("abc")).toThrow();
    expect(() => parseDollarsToCents("-5")).toThrow();
  });
});
