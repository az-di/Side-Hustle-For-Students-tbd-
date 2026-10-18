import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveListing, setSellerPaused, setSellerTag } from "@/modules/catalog/mutations";
import { createOpenRequest } from "@/modules/requests/mutations";
import { blockUser } from "@/modules/trust/mutations";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { setInterestPreference } from "./mutations";
import { listInterests } from "./queries";

/**
 * The watched-tag alert, end to end: a request records an interest; each of
 * the three seller triggers notifies watchers exactly once per month; the
 * off switch, the 90-day window, blocks and the "already had it" cases all
 * produce nothing.
 */

let tag: { id: string };
let otherTag: { id: string };
let buyer: { id: string };
let stale: { id: string };
let optedOut: { id: string };
let blocked: { id: string };
let seller: { id: string };

const budget = { grossFixedBudgetCents: 5_000, grossHourlyBudgetCents: null };

async function post(buyerUserId: string, tagIds: string[]) {
  return createOpenRequest({
    buyerUserId,
    title: "Watched-tag fixture",
    details: "Integration test fixture, safe to delete.",
    tagIds,
    ...budget,
  });
}

async function alertsFor(userId: string) {
  return db.notification.findMany({ where: { userId, kind: "SELLER_OPEN_TO_TAG" }, select: { tagId: true, dedupeKey: true } });
}

beforeAll(async () => {
  tag = await makeTag();
  otherTag = await makeTag();
  buyer = await makeUser();
  stale = await makeUser();
  optedOut = await makeUser();
  blocked = await makeUser();
  seller = await makeUser({ seller: true });

  await post(buyer.id, [tag.id, otherTag.id]);
  await post(stale.id, [tag.id]);
  await post(optedOut.id, [tag.id]);
  await post(blocked.id, [tag.id]);

  await db.buyerTagInterest.update({
    where: { buyerUserId_tagId: { buyerUserId: stale.id, tagId: tag.id } },
    data: { lastRequestedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
  });
  await setInterestPreference({ buyerUserId: optedOut.id, tagId: tag.id, notifyOnNewSeller: false });
  await blockUser({ blockerUserId: blocked.id, blockedUserId: seller.id });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("recording interest", () => {
  it("records one interest per tag on a request and lists it as active", async () => {
    const interests = await listInterests(buyer.id);
    expect(interests.map((i) => i.tagId).sort()).toEqual([tag.id, otherTag.id].sort());
    expect(interests.every((i) => i.active && i.notifyOnNewSeller)).toBe(true);
  });

  it("shows a lapsed interest as inactive without flipping the switch", async () => {
    const [interest] = await listInterests(stale.id);
    expect(interest.notifyOnNewSeller).toBe(true);
    expect(interest.active).toBe(false);
  });
});

describe("seller adds a tag", () => {
  it("alerts the active watcher only — not stale, opted-out or blocked buyers", async () => {
    await setSellerTag({ userId: seller.id, tagId: tag.id, on: true });

    expect(await alertsFor(buyer.id)).toHaveLength(1);
    expect(await alertsFor(stale.id)).toHaveLength(0);
    expect(await alertsFor(optedOut.id)).toHaveLength(0);
    expect(await alertsFor(blocked.id)).toHaveLength(0);
  });

  it("queues a digest email for the alerted buyer, not an immediate one", async () => {
    const rows = await db.outboundEmail.findMany({ where: { userId: buyer.id } });
    expect(rows.map((r) => r.template)).toEqual(["digest"]);
  });

  it("does not alert again when the tag is toggled off and on in the same month", async () => {
    await setSellerTag({ userId: seller.id, tagId: tag.id, on: false });
    await setSellerTag({ userId: seller.id, tagId: tag.id, on: true });
    expect(await alertsFor(buyer.id)).toHaveLength(1);
  });
});

describe("seller resumes from pause", () => {
  it("alerts for every tag the seller holds, deduped against earlier alerts", async () => {
    await setSellerPaused({ userId: seller.id, paused: true });
    await setSellerPaused({ userId: seller.id, paused: false });
    // tag was already alerted this month; nothing new for it.
    expect(await alertsFor(buyer.id)).toHaveLength(1);

    // Repeating "resume" is a no-op, not a re-trigger.
    await setSellerPaused({ userId: seller.id, paused: false });
    expect(await alertsFor(buyer.id)).toHaveLength(1);
  });

  it("a paused seller adding a tag announces nothing until they resume", async () => {
    await setSellerPaused({ userId: seller.id, paused: true });
    await setSellerTag({ userId: seller.id, tagId: otherTag.id, on: true });
    expect((await alertsFor(buyer.id)).map((a) => a.tagId)).not.toContain(otherTag.id);

    await setSellerPaused({ userId: seller.id, paused: false });
    expect((await alertsFor(buyer.id)).map((a) => a.tagId)).toContain(otherTag.id);
  });
});

describe("seller publishes a listing", () => {
  it("alerts only for tags that are new to the seller", async () => {
    const third = await makeTag();
    await post(buyer.id, [third.id]);

    await saveListing({
      sellerUserId: seller.id,
      title: "Listing fixture",
      description: "Integration test fixture, safe to delete.",
      fixedPriceCents: 1_000,
      hourlyRateCents: null,
      turnaroundDays: null,
      tagIds: [tag.id, third.id],
    });

    const alerts = await alertsFor(buyer.id);
    expect(alerts.filter((a) => a.tagId === third.id)).toHaveLength(1);
    expect(alerts.filter((a) => a.tagId === tag.id)).toHaveLength(1); // unchanged
  });
});
