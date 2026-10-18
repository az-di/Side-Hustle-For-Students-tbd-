import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { blockedUserIds, isBlocked } from "@/modules/trust/block-filter";

export async function listThreadsForUser(userId: string) {
  // Conversations with a blocked person leave the inbox. The rows stay (a job
  // thread is history) and are reachable from the job page.
  const hidden = await blockedUserIds(userId);
  const rows = await db.thread.findMany({
    where: {
      OR: [
        { buyerUserId: userId, ...(hidden.length > 0 ? { sellerUserId: { notIn: hidden } } : {}) },
        { sellerUserId: userId, ...(hidden.length > 0 ? { buyerUserId: { notIn: hidden } } : {}) },
      ],
    },
    select: {
      id: true,
      kind: true,
      buyerUserId: true,
      lastMessageAt: true,
      lastReadBuyerAt: true,
      lastReadSellerAt: true,
      jobId: true,
      request: { select: { id: true, title: true } },
      buyer: { select: { handle: true, displayName: true } },
      seller: { select: { handle: true, displayName: true } },
      messages: { select: { body: true, senderUserId: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  return rows.map((row) => {
    const isBuyer = row.buyerUserId === userId;
    const lastRead = isBuyer ? row.lastReadBuyerAt : row.lastReadSellerAt;
    return {
      id: row.id,
      title: row.request?.title ?? (row.kind === "INQUIRY" ? "Inquiry" : "Conversation"),
      counterparty: isBuyer ? row.seller : row.buyer,
      role: isBuyer ? ("BUYER" as const) : ("SELLER" as const),
      lastMessage: row.messages[0]?.body ?? null,
      lastMessageAt: row.lastMessageAt,
      unread: lastRead === null || lastRead.getTime() < row.lastMessageAt.getTime(),
      jobId: row.jobId,
      requestId: row.request?.id ?? null,
    };
  });
}

/**
 * One conversation.
 *
 * Messages are a SHARED surface — both parties read the same rows — which is
 * why system messages are written without any money figure. Nothing here
 * converts or exposes an amount.
 */
export async function getThreadForViewer(threadId: string, viewerId: string) {
  const row = await db.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      kind: true,
      buyerUserId: true,
      sellerUserId: true,
      jobId: true,
      request: { select: { id: true, title: true, status: true } },
      requestResponse: { select: { status: true } },
      buyer: { select: { id: true, handle: true, displayName: true } },
      seller: { select: { id: true, handle: true, displayName: true } },
      messages: {
        select: { id: true, body: true, senderUserId: true, systemKind: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
  if (!row) throw notFound("That conversation");

  const isBuyer = row.buyerUserId === viewerId;
  const isSeller = row.sellerUserId === viewerId;
  if (!isBuyer && !isSeller) throw notFound("That conversation");

  const blocked = await isBlocked(row.buyerUserId, row.sellerUserId);

  return {
    id: row.id,
    kind: row.kind,
    role: isBuyer ? ("BUYER" as const) : ("SELLER" as const),
    counterparty: isBuyer ? row.seller : row.buyer,
    title: row.request?.title ?? (row.kind === "INQUIRY" ? "Inquiry" : "Conversation"),
    requestId: row.request?.id ?? null,
    jobId: row.jobId,
    /** Losing responders can read the thread but not post into it. */
    isClosed: row.requestResponse?.status === "SUPERSEDED" || row.request?.status === "DECLINED",
    /** Readable history, no composer. Same flag whichever way the block runs. */
    isBlocked: blocked,
    messages: row.messages.map((m) => ({
      id: m.id,
      body: m.body,
      isMine: m.senderUserId === viewerId,
      isSystem: m.senderUserId === null,
      createdAt: m.createdAt,
    })),
  };
}

export async function listNotificationsForUser(userId: string) {
  return db.notification.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      readAt: true,
      createdAt: true,
      requestId: true,
      jobId: true,
      threadId: true,
      actor: { select: { handle: true, displayName: true } },
      request: { select: { title: true } },
      job: { select: { request: { select: { title: true } } } },
      tag: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
