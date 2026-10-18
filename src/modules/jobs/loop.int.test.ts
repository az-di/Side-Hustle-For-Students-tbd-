import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sendMessage } from "@/modules/messaging/mutations";
import { createDirectRequest, acceptDirectRequest } from "@/modules/requests/mutations";
import { getRequestForViewer } from "@/modules/requests/queries";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { confirmJobComplete, createReview, markJobComplete, materializeAutoComplete } from "./mutations";
import { getJobForViewer } from "./queries";

/**
 * The whole loop, at the module level: request → accept → chat → mark →
 * confirm → review, with the double-click and wrong-party cases, and the
 * auto-confirm window run in milliseconds through the injectable clock.
 */

let tag: { id: string };
let buyer: { id: string };
let seller: { id: string };

const budget = { grossFixedBudgetCents: 10_000, grossHourlyBudgetCents: null };

async function startJob(title: string) {
  const { requestId } = await createDirectRequest({
    buyerUserId: buyer.id,
    targetSellerUserId: seller.id,
    title,
    details: "Integration test fixture, safe to delete.",
    tagIds: [tag.id],
    ...budget,
  });
  const { jobId, threadId } = await acceptDirectRequest({ requestId, sellerUserId: seller.id });
  return { requestId, jobId, threadId };
}

beforeAll(async () => {
  tag = await makeTag();
  buyer = await makeUser();
  seller = await makeUser({ seller: true, tagIds: [tag.id] });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("the happy path", () => {
  it("runs end to end and the seller never sees the gross figure", async () => {
    const { requestId, jobId, threadId } = await startJob("Loop fixture");

    // The seller's view of the request and job carry the payout only.
    const sellerView = await getRequestForViewer(requestId, seller.id);
    expect(sellerView.role).toBe("SELLER");
    expect(JSON.stringify(sellerView)).not.toMatch(/\b10000\b|gross|budget/i);
    if (sellerView.role === "SELLER") expect(sellerView.request.payoutFixedCents).toBe(9_000);

    const sellerJob = await getJobForViewer(jobId, seller.id);
    expect(sellerJob.role).toBe("SELLER");
    expect(JSON.stringify(sellerJob)).not.toMatch(/\b10000\b|gross|budget/i);

    // Marking complete needs both people to have spoken.
    await expect(markJobComplete({ jobId, actorUserId: seller.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await sendMessage({ threadId, senderUserId: buyer.id, body: "Looks great!" });
    await sendMessage({ threadId, senderUserId: seller.id, body: "Delivered." });

    await markJobComplete({ jobId, actorUserId: seller.id });
    // Only the OTHER party may confirm; marking twice is a conflict.
    await expect(confirmJobComplete({ jobId, actorUserId: seller.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(markJobComplete({ jobId, actorUserId: buyer.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await confirmJobComplete({ jobId, actorUserId: buyer.id });

    // Reviews: buyer only, once.
    await expect(createReview({ jobId, buyerUserId: seller.id, rating: 5, body: null })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await createReview({ jobId, buyerUserId: buyer.id, rating: 5, body: "Great work." });
    await expect(createReview({ jobId, buyerUserId: buyer.id, rating: 4, body: null })).rejects.toMatchObject({ code: "CONFLICT" });

    const profile = await db.sellerProfile.findUniqueOrThrow({ where: { userId: seller.id } });
    expect(profile.completedJobCount).toBe(1);
    expect(profile.ratingCount).toBe(1);
    expect(profile.ratingAvg).toBe(5);
  });

  it("survives a double-click on confirm", async () => {
    const { jobId, threadId } = await startJob("Double-confirm fixture");
    await sendMessage({ threadId, senderUserId: buyer.id, body: "hi" });
    await sendMessage({ threadId, senderUserId: seller.id, body: "hi" });
    await markJobComplete({ jobId, actorUserId: buyer.id });

    const clicks = await Promise.allSettled([
      confirmJobComplete({ jobId, actorUserId: seller.id }),
      confirmJobComplete({ jobId, actorUserId: seller.id }),
    ]);
    expect(clicks.filter((c) => c.status === "fulfilled")).toHaveLength(1);
    expect((await db.sellerProfile.findUniqueOrThrow({ where: { userId: seller.id } })).completedJobCount).toBe(2);
  });
});

describe("auto-confirm, with the clock injected", () => {
  it("completes as AUTO after the window and does not inflate the public count", async () => {
    const { jobId, threadId } = await startJob("Auto-confirm fixture");
    await sendMessage({ threadId, senderUserId: buyer.id, body: "hi" });
    await sendMessage({ threadId, senderUserId: seller.id, body: "hi" });

    const t0 = new Date("2030-01-01T00:00:00Z");
    await markJobComplete({ jobId, actorUserId: seller.id }, { now: t0, autoCompleteMs: 120_000 });

    expect(await materializeAutoComplete(jobId, new Date(t0.getTime() + 119_000))).toBe(false);
    expect(await materializeAutoComplete(jobId, new Date(t0.getTime() + 120_000))).toBe(true);
    expect(await materializeAutoComplete(jobId, new Date(t0.getTime() + 121_000))).toBe(false); // idempotent

    const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("COMPLETED");
    expect(job.completionSource).toBe("AUTO");

    const profile = await db.sellerProfile.findUniqueOrThrow({ where: { userId: seller.id } });
    expect(profile.autoCompletedCount).toBe(1);
    expect(profile.completedJobCount).toBe(2); // unchanged from the mutual ones above

    // An auto-completed job is still reviewable.
    await createReview({ jobId, buyerUserId: buyer.id, rating: 3, body: "Never confirmed, but fine." });
  });
});
