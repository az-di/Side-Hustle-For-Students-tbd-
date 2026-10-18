import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { blockUser } from "@/modules/trust/mutations";
import { cleanup, makeUser } from "@/test/factories";
import { openInquiry, sendMessage } from "./mutations";
import { getThreadForViewer, listThreadsForUser } from "./queries";
import { MAX_NEW_INQUIRIES_PER_DAY } from "./state";

let buyer: { id: string };
let seller: { id: string };
let notASeller: { id: string };

beforeAll(async () => {
  buyer = await makeUser();
  seller = await makeUser({ seller: true });
  notASeller = await makeUser();
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("inquiry threads", () => {
  it("opens one thread per pair and returns to it on a second open", async () => {
    const first = await openInquiry({ buyerUserId: buyer.id, sellerUserId: seller.id });
    const second = await openInquiry({ buyerUserId: buyer.id, sellerUserId: seller.id });
    expect(first.created).toBe(true);
    expect(second).toEqual({ threadId: first.threadId, created: false });

    const thread = await getThreadForViewer(first.threadId, seller.id);
    expect(thread.kind).toBe("INQUIRY");
    expect(thread.role).toBe("SELLER");
    expect(thread.isClosed).toBe(false);
  });

  it("carries messages both ways and shows up in both inboxes", async () => {
    const { threadId } = await openInquiry({ buyerUserId: buyer.id, sellerUserId: seller.id });
    await sendMessage({ threadId, senderUserId: buyer.id, body: "Free on the 7th?" });
    await sendMessage({ threadId, senderUserId: seller.id, body: "Yes — send a request and I'll accept." });

    expect((await listThreadsForUser(buyer.id)).map((t) => t.id)).toContain(threadId);
    expect((await listThreadsForUser(seller.id)).map((t) => t.id)).toContain(threadId);
  });

  it("refuses self, non-sellers and blocked pairs", async () => {
    await expect(openInquiry({ buyerUserId: buyer.id, sellerUserId: buyer.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(openInquiry({ buyerUserId: buyer.id, sellerUserId: notASeller.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });

    const blockedSeller = await makeUser({ seller: true });
    await blockUser({ blockerUserId: blockedSeller.id, blockedUserId: buyer.id });
    await expect(openInquiry({ buyerUserId: buyer.id, sellerUserId: blockedSeller.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("rate-limits NEW conversations per day but not returning to an old one", async () => {
    const spammer = await makeUser();
    for (let i = 0; i < MAX_NEW_INQUIRIES_PER_DAY; i++) {
      const target = await makeUser({ seller: true });
      await openInquiry({ buyerUserId: spammer.id, sellerUserId: target.id });
    }
    const oneMore = await makeUser({ seller: true });
    await expect(openInquiry({ buyerUserId: spammer.id, sellerUserId: oneMore.id })).rejects.toMatchObject({ code: "NOT_ALLOWED" });

    // Returning to an existing thread is not a new conversation.
    const existing = await db.thread.findFirstOrThrow({ where: { kind: "INQUIRY", buyerUserId: spammer.id } });
    await expect(openInquiry({ buyerUserId: spammer.id, sellerUserId: existing.sellerUserId })).resolves.toMatchObject({
      threadId: existing.id,
      created: false,
    });
  });
});
