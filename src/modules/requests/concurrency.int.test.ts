import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { createOpenRequest, respondToOpenRequest, selectResponse } from "./mutations";

/**
 * The races the handoff called out. Each one would, if lost, create a second
 * job or a second winner — the unique constraints are the backstop and the
 * `WHERE status = …` guards are the first line. Both are exercised here by
 * firing the same mutation concurrently.
 */

let tag: { id: string };
let buyer: { id: string };
let sellers: { id: string }[];

const budget = { grossFixedBudgetCents: 10_000, grossHourlyBudgetCents: null };

beforeAll(async () => {
  tag = await makeTag();
  buyer = await makeUser();
  sellers = await Promise.all([1, 2, 3].map(() => makeUser({ seller: true, tagIds: [tag.id] })));
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("selecting a response", () => {
  it("picks exactly one winner when the buyer double-clicks across three responders", async () => {
    const { requestId } = await createOpenRequest({
      buyerUserId: buyer.id,
      title: "Concurrency fixture",
      details: "Integration test fixture, safe to delete.",
      tagIds: [tag.id],
      ...budget,
    });

    const responses = await Promise.all(
      sellers.map((s) => respondToOpenRequest({ requestId, sellerUserId: s.id, message: "I can do this." })),
    );

    // Six simultaneous picks: two clicks on each of three responders.
    const picks = await Promise.allSettled(
      responses.flatMap((r) => [
        selectResponse({ requestId, buyerUserId: buyer.id, responseId: r.responseId }),
        selectResponse({ requestId, buyerUserId: buyer.id, responseId: r.responseId }),
      ]),
    );

    const won = picks.filter((p) => p.status === "fulfilled");
    expect(won).toHaveLength(1);

    const request = await db.request.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, chosenResponseId: true, responses: { select: { status: true } }, job: { select: { id: true } } },
    });
    expect(request.status).toBe("MATCHED");
    expect(request.job).not.toBeNull();
    expect(request.responses.filter((r) => r.status === "SELECTED")).toHaveLength(1);
    expect(request.responses.filter((r) => r.status === "SUPERSEDED")).toHaveLength(2);
    expect(await db.job.count({ where: { requestId } })).toBe(1);
  });

  it("refuses a second response from the same seller even when sent twice at once", async () => {
    const { requestId } = await createOpenRequest({
      buyerUserId: buyer.id,
      title: "Double-respond fixture",
      details: "Integration test fixture, safe to delete.",
      tagIds: [tag.id],
      ...budget,
    });

    const attempts = await Promise.allSettled([
      respondToOpenRequest({ requestId, sellerUserId: sellers[0].id, message: "first" }),
      respondToOpenRequest({ requestId, sellerUserId: sellers[0].id, message: "second" }),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(await db.requestResponse.count({ where: { requestId, sellerUserId: sellers[0].id } })).toBe(1);
  });
});

describe("open-request fan-out", () => {
  it("notifies available sellers in the tag and skips paused ones and the buyer", async () => {
    const paused = await makeUser({ seller: true, tagIds: [tag.id] });
    await db.sellerProfile.update({ where: { userId: paused.id }, data: { isAvailable: false } });
    const buyerWhoSells = await makeUser({ seller: true, tagIds: [tag.id] });

    const { requestId, notified } = await createOpenRequest({
      buyerUserId: buyerWhoSells.id,
      title: "Fan-out fixture",
      details: "Integration test fixture, safe to delete.",
      tagIds: [tag.id],
      ...budget,
    });

    const recipients = (
      await db.notification.findMany({ where: { requestId, kind: "OPEN_REQUEST_IN_TAG" }, select: { userId: true } })
    ).map((n) => n.userId);

    expect(notified).toBe(recipients.length);
    for (const s of sellers) expect(recipients).toContain(s.id);
    expect(recipients).not.toContain(paused.id);
    expect(recipients).not.toContain(buyerWhoSells.id);
  });
});
