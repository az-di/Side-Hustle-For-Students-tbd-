import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { unreadCounts } from "@/modules/notifications/queries";

/**
 * The single endpoint the client polls (every 20s, and on tab focus).
 * Counts only — the notification list itself is a normal page.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ unreadNotifications: 0, unreadThreads: 0 }, { status: 200 });
  }

  const counts = await unreadCounts(viewer.id);
  return NextResponse.json(
    { ...counts, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
