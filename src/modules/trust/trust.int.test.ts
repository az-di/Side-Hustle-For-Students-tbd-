import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listSellersForTag } from "@/modules/catalog/queries";
import { sendMessage } from "@/modules/messaging/mutations";
import { listThreadsForUser } from "@/modules/messaging/queries";
import { createDirectRequest, createOpenRequest, respondToOpenRequest } from "@/modules/requests/mutations";
import { getRequestForViewer, listIncomingDirectRequests, listOpenRequestsForSeller } from "@/modules/requests/queries";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { blockUser, reportUser, resolveReport, unblockUser } from "./mutations";

/**
 * Blocking is enforced in two different places — point actions and feeds —
 * and this suite proves both, in BOTH directions. If a new feed is added,
 * add it to FEEDS below.
 */

let tag: { id: string };
let buyer: { id: string; handle: string };
let seller: { id: string; handle: string };
let bystander: { id: string; handle: string };

beforeAll(async () => {
  tag = await makeTag();
  buyer = await makeUser();
  seller = await makeUser({ seller: true, tagIds: [tag.id] });
  bystander = await makeUser({ seller: true, tagIds: [tag.id] });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const budget = { grossFixedBudgetCents: 10_000, grossHourlyBudgetCents: null };

async function openRequest() {
  return createOpenRequest({
    buyerUserId: buyer.id,
    title: "Blocked-feed test request",
    details: "Integration test fixture, safe to delete.",
    tagIds: [tag.id],
    ...budget,
  });
}

describe("blocking, in both directions", () => {
  const directions = [
    ["buyer blocks seller", () => blockUser({ blockerUserId: buyer.id, blockedUserId: seller.id })],
    ["seller blocks buyer", () => blockUser({ blockerUserId: seller.id, blockedUserId: buyer.id })],
  ] as const;

  describe.each(directions)("%s", (_label, block) => {
    let requestId: string;

    beforeAll(async () => {
      await db.block.deleteMany({ where: { OR: [{ blockerUserId: buyer.id }, { blockerUserId: seller.id }] } });
      await db.request.deleteMany({ where: { buyerUserId: buyer.id } });
      // Block first: the fan-out assertion below is about a request posted
      // while the block already existed.
      await block();
      ({ requestId } = await openRequest());
    });

    it("hides the open request from the seller's feed, but not from a bystander", async () => {
      const sellerFeed = await listOpenRequestsForSeller(seller.id);
      expect(sellerFeed.map((r) => r.id)).not.toContain(requestId);

      const bystanderFeed = await listOpenRequestsForSeller(bystander.id);
      expect(bystanderFeed.map((r) => r.id)).toContain(requestId);
    });

    it("hides the request page from the seller", async () => {
      await expect(getRequestForViewer(requestId, seller.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("hides the seller from the buyer's search results", async () => {
      const results = await listSellersForTag({ tagId: tag.id, viewerId: buyer.id });
      expect(results.map((s) => s.userId)).not.toContain(seller.id);
      expect(results.map((s) => s.userId)).toContain(bystander.id);
    });

    it("refuses a direct request", async () => {
      await expect(
        createDirectRequest({
          buyerUserId: buyer.id,
          targetSellerUserId: seller.id,
          title: "Direct to blocked",
          details: "Should be refused by assertCanReach.",
          tagIds: [tag.id],
          ...budget,
        }),
      ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    });

    it("refuses a response to the open request", async () => {
      await expect(
        respondToOpenRequest({ requestId, sellerUserId: seller.id, message: "Should be refused." }),
      ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    });

    it("did not fan a notification out to the blocked seller", async () => {
      const rows = await db.notification.findMany({
        where: { requestId, kind: "OPEN_REQUEST_IN_TAG" },
        select: { userId: true },
      });
      expect(rows.map((r) => r.userId)).not.toContain(seller.id);
      expect(rows.map((r) => r.userId)).toContain(bystander.id);
    });
  });
});

describe("blocking an existing conversation", () => {
  let threadId: string;

  beforeAll(async () => {
    await db.block.deleteMany({ where: { OR: [{ blockerUserId: buyer.id }, { blockerUserId: seller.id }] } });
    const direct = await createDirectRequest({
      buyerUserId: buyer.id,
      targetSellerUserId: seller.id,
      title: "Thread block test",
      details: "Integration test fixture, safe to delete.",
      tagIds: [tag.id],
      ...budget,
    });
    threadId = direct.threadId;
    await sendMessage({ threadId, senderUserId: seller.id, body: "hello before the block" });
  });

  it("removes the thread from both inboxes and refuses new messages, then restores it on unblock", async () => {
    await blockUser({ blockerUserId: seller.id, blockedUserId: buyer.id });

    expect((await listThreadsForUser(buyer.id)).map((t) => t.id)).not.toContain(threadId);
    expect((await listThreadsForUser(seller.id)).map((t) => t.id)).not.toContain(threadId);
    await expect(sendMessage({ threadId, senderUserId: buyer.id, body: "blocked" })).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });

    const incoming = await listIncomingDirectRequests(seller.id);
    expect(incoming.map((r) => r.title)).not.toContain("Thread block test");

    await unblockUser({ blockerUserId: seller.id, blockedUserId: buyer.id });
    expect((await listThreadsForUser(buyer.id)).map((t) => t.id)).toContain(threadId);
    await expect(sendMessage({ threadId, senderUserId: buyer.id, body: "unblocked" })).resolves.toBeUndefined();
  });
});

describe("reports and auto-suspension", () => {
  let reporterA: { id: string; handle: string };
  let reporterB: { id: string; handle: string };
  let subject: { id: string; handle: string };
  let admin: { id: string; handle: string };

  beforeAll(async () => {
    reporterA = await makeUser();
    reporterB = await makeUser();
    subject = await makeUser({ seller: true, tagIds: [tag.id] });
    admin = await makeUser({ isAdmin: true });
    // Reports require a shared thread.
    for (const reporter of [reporterA, reporterB]) {
      await createDirectRequest({
        buyerUserId: reporter.id,
        targetSellerUserId: subject.id,
        title: "Report fixture",
        details: "Integration test fixture, safe to delete.",
        tagIds: [tag.id],
        ...budget,
      });
    }
  });

  it("refuses a report from a stranger", async () => {
    await expect(
      reportUser({ reporterUserId: bystander.id, subjectUserId: subject.id, kind: "SPAM", reason: "never met them" }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("suspends at the threshold, keeps standing hidden from feeds, and reinstates when dismissed", async () => {
    await reportUser({ reporterUserId: reporterA.id, subjectUserId: subject.id, kind: "NO_SHOW", reason: "no-showed twice" });
    let user = await db.user.findUniqueOrThrow({ where: { id: subject.id }, select: { status: true } });
    expect(user.status).toBe("ACTIVE");

    // SCAM weighs 3, which is the default threshold on its own.
    const { reportId } = await reportUser({
      reporterUserId: reporterB.id,
      subjectUserId: subject.id,
      kind: "SCAM",
      reason: "took the deposit and vanished",
    });
    user = await db.user.findUniqueOrThrow({ where: { id: subject.id }, select: { status: true } });
    expect(user.status).toBe("SUSPENDED");

    // Suspended sellers vanish from search and from fan-out.
    const results = await listSellersForTag({ tagId: tag.id });
    expect(results.map((s) => s.userId)).not.toContain(subject.id);

    // Dismissing the heavy report drops the weight to 1 and auto-reinstates.
    await resolveReport({ adminUserId: admin.id, reportId, outcome: "DISMISSED" });
    user = await db.user.findUniqueOrThrow({ where: { id: subject.id }, select: { status: true } });
    expect(user.status).toBe("ACTIVE");
  });

  it("accepts one report per reporter per scope", async () => {
    await expect(
      reportUser({ reporterUserId: reporterA.id, subjectUserId: subject.id, kind: "NO_SHOW", reason: "again, same thing" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only admins can resolve", async () => {
    const report = await db.report.findFirstOrThrow({ where: { subjectUserId: subject.id, status: "OPEN" } });
    await expect(
      resolveReport({ adminUserId: reporterA.id, reportId: report.id, outcome: "UPHELD" }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});
