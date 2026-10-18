import { db } from "@/lib/db";
import { invalid, notAllowed, notFound } from "@/lib/errors";
import { notify } from "@/modules/notifications/mutations";
import { consumeRateLimit } from "@/modules/ratelimit/mutations";
import { assertCanReach } from "@/modules/trust/mutations";
import { MAX_MESSAGE_LENGTH, canOpenInquiry, inquiryKey } from "./state";

/**
 * A buyer opens (or returns to) their one inquiry thread with a seller.
 * Idempotent: the unique inquiryKey means a double-click or a second visit
 * lands in the same conversation. Only NEW threads count against the daily
 * limit.
 */
export async function openInquiry(params: { buyerUserId: string; sellerUserId: string }): Promise<{ threadId: string; created: boolean }> {
  const key = inquiryKey(params.buyerUserId, params.sellerUserId);

  const existing = await db.thread.findUnique({ where: { inquiryKey: key }, select: { id: true } });
  if (existing) return { threadId: existing.id, created: false };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [seller, openedToday] = await Promise.all([
    db.sellerProfile.findUnique({ where: { userId: params.sellerUserId }, select: { userId: true } }),
    db.thread.count({ where: { kind: "INQUIRY", buyerUserId: params.buyerUserId, createdAt: { gte: since } } }),
  ]);

  const decision = canOpenInquiry({
    isSelf: params.buyerUserId === params.sellerUserId,
    sellerExists: seller !== null,
    openedToday,
  });
  if (!decision.ok) throw notAllowed(decision.message);
  await assertCanReach(params.buyerUserId, params.sellerUserId);

  const thread = await db.thread.create({
    data: {
      kind: "INQUIRY",
      buyerUserId: params.buyerUserId,
      sellerUserId: params.sellerUserId,
      inquiryKey: key,
      messages: { create: { systemKind: "REQUEST_CREATED", body: "Conversation started — ask away. Requests are made from their profile." } },
    },
    select: { id: true },
  });
  return { threadId: thread.id, created: true };
}

/**
 * Messaging is thread-scoped: a thread always belongs to a request, a response,
 * a job, or a buyer-opened inquiry, so there is no way to cold-message a
 * stranger beyond the rate-limited inquiry above.
 */
export async function sendMessage(params: {
  threadId: string;
  senderUserId: string;
  body: string;
}): Promise<void> {
  const body = params.body.trim();
  if (body.length === 0) throw invalid("Write something first.");
  if (body.length > MAX_MESSAGE_LENGTH) throw invalid("That message is too long.");

  const thread = await db.thread.findUnique({
    where: { id: params.threadId },
    select: { id: true, buyerUserId: true, sellerUserId: true },
  });
  if (!thread) throw notFound("That conversation");

  const isParty = params.senderUserId === thread.buyerUserId || params.senderUserId === thread.sellerUserId;
  if (!isParty) throw notAllowed("You are not part of this conversation.");

  const isBuyer = params.senderUserId === thread.buyerUserId;
  const recipient = isBuyer ? thread.sellerUserId : thread.buyerUserId;
  const now = new Date();

  // A thread outlives a block (the job history stays readable), but nobody
  // can post into it while one exists.
  await assertCanReach(params.senderUserId, recipient);
  await consumeRateLimit("message_send", params.senderUserId);

  await db.$transaction(async (tx) => {
    await tx.message.create({
      data: { threadId: thread.id, senderUserId: params.senderUserId, body },
    });

    await tx.thread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        // Sending is also reading, for the sender.
        ...(isBuyer ? { lastReadBuyerAt: now } : { lastReadSellerAt: now }),
      },
    });

    // One notification per thread until it is read, rather than one per
    // message: a chatty seller should not produce 20 badge increments.
    await notify(tx, {
      userId: recipient,
      kind: "MESSAGE_RECEIVED",
      dedupeKey: `message:${thread.id}:${recipient}:${now.toISOString().slice(0, 10)}`,
      actorUserId: params.senderUserId,
      threadId: thread.id,
    });
  });
}

export async function markThreadRead(params: { threadId: string; userId: string }): Promise<void> {
  const thread = await db.thread.findUnique({
    where: { id: params.threadId },
    select: { buyerUserId: true, sellerUserId: true },
  });
  if (!thread) return;

  const isBuyer = params.userId === thread.buyerUserId;
  if (!isBuyer && params.userId !== thread.sellerUserId) return;

  await db.thread.update({
    where: { id: params.threadId },
    data: isBuyer ? { lastReadBuyerAt: new Date() } : { lastReadSellerAt: new Date() },
  });

  await db.notification.updateMany({
    where: { userId: params.userId, threadId: params.threadId, kind: "MESSAGE_RECEIVED", readAt: null },
    data: { readAt: new Date() },
  });
}
