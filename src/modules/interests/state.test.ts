import { describe, expect, it } from "vitest";
import { WATCH_WINDOW_DAYS, isWatching, sellerOpenDedupeKey } from "./state";

const now = new Date("2030-03-15T12:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("sellerOpenDedupeKey", () => {
  it("is one per seller, tag and calendar month", () => {
    expect(sellerOpenDedupeKey("s1", "t1", now)).toBe("seller_open:s1:t1:2030-03");
    expect(sellerOpenDedupeKey("s1", "t1", new Date("2030-03-31T23:59:59Z"))).toBe("seller_open:s1:t1:2030-03");
    expect(sellerOpenDedupeKey("s1", "t1", new Date("2030-04-01T00:00:00Z"))).toBe("seller_open:s1:t1:2030-04");
  });
});

describe("isWatching", () => {
  const fresh = { notifyOnNewSeller: true, lastRequestedAt: days(1), mutedUntil: null };

  it("watches a recent, unmuted, opted-in interest", () => {
    expect(isWatching(fresh, now)).toBe(true);
  });

  it("stops watching once the last request is older than the window", () => {
    expect(isWatching({ ...fresh, lastRequestedAt: days(WATCH_WINDOW_DAYS - 1) }, now)).toBe(true);
    expect(isWatching({ ...fresh, lastRequestedAt: days(WATCH_WINDOW_DAYS + 1) }, now)).toBe(false);
  });

  it("respects the off switch", () => {
    expect(isWatching({ ...fresh, notifyOnNewSeller: false }, now)).toBe(false);
  });

  it("respects a mute until it lapses", () => {
    expect(isWatching({ ...fresh, mutedUntil: days(-1) }, now)).toBe(false);
    expect(isWatching({ ...fresh, mutedUntil: days(1) }, now)).toBe(true);
  });
});
