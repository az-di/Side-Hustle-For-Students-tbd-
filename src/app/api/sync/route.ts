import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * The single endpoint the client polls (every 20s, and on tab focus).
 *
 * Counts only — the notification list itself is a normal page. Both queries are
 * served by indexes built for exactly this: the partial index on unread
 * notifications, and the per-user lastMessageAt indexes on Thread.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ unreadNotifications: 0, unreadThreads: 0 }, { status: 200 });
  }

  const [unreadNotifications, threads] = await Promise.all([
    db.notification.count({ where: { userId: viewer.id, readAt: null } }),
    db.thread.findMany({
      where: { OR: [{ buyerUserId: viewer.id }, { sellerUserId: viewer.id }] },
      select: {
        buyerUserId: true,
        lastMessageAt: true,
        lastReadBuyerAt: true,
        lastReadSellerAt: true,
      },
    }),
  ]);

  const unreadThreads = threads.filter((t) => {
    const lastRead = t.buyerUserId === viewer.id ? t.lastReadBuyerAt : t.lastReadSellerAt;
    return lastRead === null || lastRead.getTime() < t.lastMessageAt.getTime();
  }).length;

  return NextResponse.json(
    { unreadNotifications, unreadThreads, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
