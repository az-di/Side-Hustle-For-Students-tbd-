import { describe, expect, it } from "vitest";
import { DIGEST_DELAY_MS, MAX_ATTEMPTS, digestBucket, nextAttemptAt, planFor } from "./state";

const now = new Date("2030-03-04T05:06:07Z");

describe("planFor", () => {
  it("digests the fan-out kind", () => {
    const plan = planFor("OPEN_REQUEST_IN_TAG", now);
    expect(plan.mode).toBe("DIGEST");
    if (plan.mode === "DIGEST") {
      expect(plan.bucket).toBe("2030-03-04");
      expect(plan.sendAfter.getTime()).toBe(now.getTime() + DIGEST_DELAY_MS);
    }
  });

  it("sends 1:1 events immediately", () => {
    for (const kind of ["DIRECT_REQUEST_RECEIVED", "RESPONSE_SELECTED", "COMPLETION_REQUESTED", "REVIEW_RECEIVED"] as const) {
      expect(planFor(kind, now)).toEqual({ mode: "IMMEDIATE" });
    }
  });

  it("skips kinds that are only noise by email", () => {
    expect(planFor("RESPONSE_NOT_SELECTED", now)).toEqual({ mode: "NONE" });
  });
});

describe("digestBucket", () => {
  it("is one per UTC day", () => {
    expect(digestBucket(new Date("2030-03-04T23:59:59Z"))).toBe("2030-03-04");
    expect(digestBucket(new Date("2030-03-05T00:00:00Z"))).toBe("2030-03-05");
  });
});

describe("nextAttemptAt", () => {
  it("backs off exponentially in minutes", () => {
    expect(nextAttemptAt(1, now)!.getTime() - now.getTime()).toBe(60_000);
    expect(nextAttemptAt(2, now)!.getTime() - now.getTime()).toBe(2 * 60_000);
    expect(nextAttemptAt(5, now)!.getTime() - now.getTime()).toBe(16 * 60_000);
  });

  it("gives up at the ceiling", () => {
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull();
  });
});
