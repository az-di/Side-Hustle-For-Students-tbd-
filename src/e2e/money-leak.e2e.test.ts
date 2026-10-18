import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sendMessage } from "@/modules/messaging/mutations";
import { acceptDirectRequest, createDirectRequest, createOpenRequest, respondToOpenRequest } from "@/modules/requests/mutations";
import { cleanup, makeTag, makeUser, signInAs } from "@/test/factories";

/**
 * THE TEST THAT PROTECTS THE PITCH.
 *
 * A buyer sets a $123.45 ceiling. Every seller-facing page is fetched over
 * HTTP as the seller, and the rendered HTML must not contain the ceiling in
 * any form — not "$123.45", not "12345", not the word "gross". The buyer's
 * own pages must show it. Distinctive figures, so a coincidental match in a
 * cuid or a timestamp cannot trip or mask it.
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const GROSS = 12_345; // $123.45 ceiling
const NET_LABEL = "$111.10"; // floor(12345 * 0.9) = 11110

const LEAK = /\$123\.45|\b12345\b|gross/i;

let tag: { id: string };
let buyer: { id: string; handle: string };
let seller: { id: string; handle: string };
let buyerCookie: string;
let sellerCookie: string;
let openRequestId: string;
let openThreadId: string;
let directRequestId: string;
let jobId: string;
let jobThreadId: string;

async function pageAs(cookie: string, path: string): Promise<string> {
  const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  expect(res.status, `${path} status`).toBe(200);
  return res.text();
}

beforeAll(async () => {
  // Reachability first, so a missing server fails with a useful message.
  await fetch(BASE + "/").catch(() => {
    throw new Error(`No server at ${BASE}. Start one (npm run build && npm start) or set E2E_BASE_URL.`);
  });

  tag = await makeTag();
  buyer = await makeUser();
  seller = await makeUser({ seller: true, tagIds: [tag.id] });
  [buyerCookie, sellerCookie] = await Promise.all([signInAs(buyer.id), signInAs(seller.id)]);

  const open = await createOpenRequest({
    buyerUserId: buyer.id,
    title: "E2E open request",
    details: "Money-leak fixture, safe to delete.",
    tagIds: [tag.id],
    grossFixedBudgetCents: GROSS,
    grossHourlyBudgetCents: null,
  });
  openRequestId = open.requestId;
  ({ threadId: openThreadId } = await respondToOpenRequest({ requestId: openRequestId, sellerUserId: seller.id, message: "I can do it." }));

  const direct = await createDirectRequest({
    buyerUserId: buyer.id,
    targetSellerUserId: seller.id,
    title: "E2E direct request",
    details: "Money-leak fixture, safe to delete.",
    tagIds: [tag.id],
    grossFixedBudgetCents: GROSS,
    grossHourlyBudgetCents: null,
  });
  directRequestId = direct.requestId;
  ({ jobId, threadId: jobThreadId } = await acceptDirectRequest({ requestId: directRequestId, sellerUserId: seller.id }));
  await sendMessage({ threadId: jobThreadId, senderUserId: buyer.id, body: "Thanks for taking this." });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("seller-facing pages never contain the buyer's ceiling", () => {
  const routes = (): [string, string][] => [
    ["home feed", "/"],
    ["requests page", "/requests"],
    ["open request", `/requests/${openRequestId}`],
    ["direct request", `/requests/${directRequestId}`],
    ["job", `/jobs/${jobId}`],
    ["request thread", `/threads/${openThreadId}`],
    ["job thread", `/threads/${jobThreadId}`],
    ["inbox", "/threads"],
    ["notifications", "/notifications"],
    ["search", `/search?tag=${encodeURIComponent("")}`],
  ];

  it.each(routes().map(([label]) => label))("%s", async (label) => {
    const path = routes().find(([l]) => l === label)![1];
    const html = await pageAs(sellerCookie, path);
    expect(html, `${label} leaked`).not.toMatch(LEAK);
  });

  it("shows the seller the payout on the request and the job", async () => {
    expect(await pageAs(sellerCookie, `/requests/${openRequestId}`)).toContain(NET_LABEL);
    expect(await pageAs(sellerCookie, `/jobs/${jobId}`)).toContain(NET_LABEL);
  });
});

describe("the buyer sees both numbers", () => {
  it("on the request and the job", async () => {
    const request = await pageAs(buyerCookie, `/requests/${openRequestId}`);
    expect(request).toContain("$123.45");
    expect(request).toContain(NET_LABEL);

    const job = await pageAs(buyerCookie, `/jobs/${jobId}`);
    expect(job).toContain("$123.45");
    expect(job).toContain(NET_LABEL);
  });
});

describe("signed out", () => {
  it("a seller-facing page redirects rather than rendering anything", async () => {
    const res = await fetch(`${BASE}/requests/${openRequestId}`, { redirect: "manual" });
    expect([302, 303, 307]).toContain(res.status);
  });
});
