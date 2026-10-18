import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDirectRequest, createOpenRequest } from "@/modules/requests/mutations";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { drainOutbox } from "./outbox";
import { renderOutboxRow } from "./templates";

/**
 * The outbox contract: an email row is written in the same transaction as the
 * notification, fan-outs collapse into one digest per recipient per day, and
 * the drain sends (via the console transport in tests) and marks rows.
 */

let tag: { id: string };
let buyer: { id: string };
let seller: { id: string };

beforeAll(async () => {
  tag = await makeTag();
  buyer = await makeUser();
  seller = await makeUser({ seller: true, tagIds: [tag.id] });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const budget = { grossFixedBudgetCents: 10_000, grossHourlyBudgetCents: null };

describe("enqueue", () => {
  it("writes an immediate email row alongside a 1:1 notification", async () => {
    await createDirectRequest({
      buyerUserId: buyer.id,
      targetSellerUserId: seller.id,
      title: "Outbox test direct",
      details: "Integration test fixture, safe to delete.",
      tagIds: [tag.id],
      ...budget,
    });

    const rows = await db.outboundEmail.findMany({ where: { userId: seller.id, template: "notification" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].sendAfter.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("collapses two open requests on the same day into one digest row", async () => {
    for (const n of [1, 2]) {
      await createOpenRequest({
        buyerUserId: buyer.id,
        title: `Outbox test open ${n}`,
        details: "Integration test fixture, safe to delete.",
        tagIds: [tag.id],
        ...budget,
      });
    }

    const digests = await db.outboundEmail.findMany({ where: { userId: seller.id, template: "digest" } });
    expect(digests).toHaveLength(1);
    expect(digests[0].sendAfter.getTime()).toBeGreaterThan(Date.now());

    // And the digest renders BOTH titles, with no money anywhere.
    const rendered = await renderOutboxRow(db, digests[0], { id: seller.id, emailUnsubKey: "k" });
    expect(rendered?.subject).toBe("2 new requests in your tags");
    expect(rendered?.text).toContain("Outbox test open 1");
    expect(rendered?.text).not.toMatch(/\$|100|9000|gross|budget/i);
  });
});

describe("drain", () => {
  it("sends due rows and marks them, leaving the future digest alone", async () => {
    const tally = await drainOutbox();
    expect(tally.sent).toBeGreaterThanOrEqual(1);

    const rows = await db.outboundEmail.findMany({ where: { userId: seller.id } });
    const immediate = rows.find((r) => r.template === "notification")!;
    const digest = rows.find((r) => r.template === "digest")!;
    expect(immediate.status).toBe("SENT");
    expect(immediate.sentAt).not.toBeNull();
    expect(digest.status).toBe("PENDING");
  });

  it("skips a recipient who opted out instead of retrying", async () => {
    await db.user.update({ where: { id: seller.id }, data: { emailOptOut: true } });
    await db.outboundEmail.updateMany({
      where: { userId: seller.id, template: "digest" },
      data: { sendAfter: new Date(0) },
    });

    await drainOutbox();
    const digest = await db.outboundEmail.findFirstOrThrow({ where: { userId: seller.id, template: "digest" } });
    expect(digest.status).toBe("SKIPPED");
  });

  it("never sends the same row twice", async () => {
    const before = await db.outboundEmail.count({ where: { userId: seller.id, status: "SENT" } });
    await drainOutbox();
    const after = await db.outboundEmail.count({ where: { userId: seller.id, status: "SENT" } });
    expect(after).toBe(before);
  });
});
