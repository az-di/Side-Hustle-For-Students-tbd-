import { describe, expect, it } from "vitest";
import { RATE_LIMITS, clientIpFrom, isOverLimit, rateLimitKey, windowExpired } from "./state";

const now = new Date("2030-01-01T00:10:00Z");

describe("windowExpired", () => {
  it("expires exactly at the window length", () => {
    const start = new Date(now.getTime() - RATE_LIMITS.otp_email.windowMs);
    expect(windowExpired(start, RATE_LIMITS.otp_email.windowMs, now)).toBe(true);
    expect(windowExpired(new Date(start.getTime() + 1), RATE_LIMITS.otp_email.windowMs, now)).toBe(false);
  });
});

describe("isOverLimit", () => {
  it("allows exactly max hits and refuses the next", () => {
    expect(isOverLimit(RATE_LIMITS.otp_email.max, RATE_LIMITS.otp_email)).toBe(false);
    expect(isOverLimit(RATE_LIMITS.otp_email.max + 1, RATE_LIMITS.otp_email)).toBe(true);
  });
});

describe("clientIpFrom", () => {
  it("takes the first forwarded address", () => {
    expect(clientIpFrom("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
  });
  it("falls back when the header is missing or empty", () => {
    expect(clientIpFrom(null)).toBe("unknown");
    expect(clientIpFrom("  ", "x")).toBe("x");
  });
});

describe("rateLimitKey", () => {
  it("namespaces by action", () => {
    expect(rateLimitKey("otp_ip", "1.2.3.4")).toBe("otp_ip:1.2.3.4");
  });
});
