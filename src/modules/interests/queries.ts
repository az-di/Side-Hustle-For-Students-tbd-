import { db } from "@/lib/db";
import { isWatching } from "./state";

export async function listInterests(buyerUserId: string, now = new Date()) {
  const rows = await db.buyerTagInterest.findMany({
    where: { buyerUserId },
    select: {
      tagId: true,
      notifyOnNewSeller: true,
      lastRequestedAt: true,
      mutedUntil: true,
      tag: { select: { name: true, slug: true, kind: true } },
    },
    orderBy: { lastRequestedAt: "desc" },
  });

  return rows.map((r) => ({
    tagId: r.tagId,
    name: r.tag.name,
    slug: r.tag.slug,
    kind: r.tag.kind,
    notifyOnNewSeller: r.notifyOnNewSeller,
    lastRequestedAt: r.lastRequestedAt,
    /** False once the 90-day window has lapsed, even if the switch is on. */
    active: isWatching(r, now),
  }));
}
