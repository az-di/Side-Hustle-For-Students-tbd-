import { db } from "@/lib/db";
import { invalid, notAllowed, notFound } from "@/lib/errors";
import { notify } from "@/modules/notifications/mutations";
import { assertCanReach } from "@/modules/trust/mutations";

const MAX_MESSAGE_LENGTH = 4_000;

/**
 * Messaging is thread-scoped: a thread always belongs to a request, a response
 * or a job, so there is no way to cold-message a stranger.
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
