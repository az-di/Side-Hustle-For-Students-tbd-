import { describe, expect, it } from "vitest";
import { MAX_NEW_INQUIRIES_PER_DAY, canOpenInquiry, inquiryKey } from "./state";

describe("inquiryKey", () => {
  it("is directional: buyer first, so a pair swapping roles gets two threads", () => {
    expect(inquiryKey("a", "b")).toBe("a:b");
    expect(inquiryKey("b", "a")).toBe("b:a");
  });
});

describe("canOpenInquiry", () => {
  const ok = { isSelf: false, sellerExists: true, openedToday: 0 };

  it("allows a first inquiry to a seller", () => {
    expect(canOpenInquiry(ok)).toEqual({ ok: true });
  });

  it("refuses messaging yourself", () => {
    expect(canOpenInquiry({ ...ok, isSelf: true }).ok).toBe(false);
  });

  it("refuses a non-seller", () => {
    expect(canOpenInquiry({ ...ok, sellerExists: false }).ok).toBe(false);
  });

  it("rate-limits new conversations per day", () => {
    expect(canOpenInquiry({ ...ok, openedToday: MAX_NEW_INQUIRIES_PER_DAY - 1 }).ok).toBe(true);
    expect(canOpenInquiry({ ...ok, openedToday: MAX_NEW_INQUIRIES_PER_DAY }).ok).toBe(false);
  });
});
