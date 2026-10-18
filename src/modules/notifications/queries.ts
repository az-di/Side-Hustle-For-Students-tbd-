import { db } from "@/lib/db";

/**
 * The two badge counts the client polls. Both are served by indexes built for
 * exactly this: the partial index on unread notifications, and the per-user
 * lastMessageAt indexes on Thread.
 */
export async function unreadCounts(userId: string): Promise<{ unreadNotifications: number; unreadThreads: number }> {
  const [unreadNotifications, threads] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.thread.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      select: { buyerUserId: true, lastMessageAt: true, lastReadBuyerAt: true, lastReadSellerAt: true },
    }),
  ]);

  const unreadThreads = threads.filter((t) => {
    const lastRead = t.buyerUserId === userId ? t.lastReadBuyerAt : t.lastReadSellerAt;
    return lastRead === null || lastRead.getTime() < t.lastMessageAt.getTime();
  }).length;

  return { unreadNotifications, unreadThreads };
}
