import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Tx } from "@/lib/tx";

/**
 * Blocking has to be enforced in two different places, and this file serves
 * both:
 *
 *   * point actions (create a request, respond, message) ask `isBlocked`
 *   * lists and feeds compose `blockedUserIds` or `notBlockedSql` into their
 *     query, because a policy check cannot filter a list
 *
 * A block is symmetric: if either person blocked the other, both are hidden
 * from each other everywhere.
 */

/** Every user this person has blocked or been blocked by. Small, so a list. */
export async function blockedUserIds(userId: string, tx: Tx = db): Promise<string[]> {
  const rows = await tx.block.findMany({
    where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
    select: { blockerUserId: true, blockedUserId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) ids.add(row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId);
  return [...ids];
}

/** Is there a block in either direction between these two people? */
export async function isBlocked(a: string, b: string, tx: Tx = db): Promise<boolean> {
  const row = await tx.block.findFirst({
    where: {
      OR: [
        { blockerUserId: a, blockedUserId: b },
        { blockerUserId: b, blockedUserId: a },
      ],
    },
    select: { blockerUserId: true },
  });
  return row !== null;
}

/**
 * SQL fragment for raw set-based statements such as the open-request fan-out.
 * `otherUserColumn` is the column holding the counterparty's id in the outer
 * query, e.g. `st."sellerUserId"`.
 */
export function notBlockedSql(userId: string, otherUserColumn: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "Block" b
    WHERE (b."blockerUserId" = ${userId} AND b."blockedUserId" = ${otherUserColumn})
       OR (b."blockedUserId" = ${userId} AND b."blockerUserId" = ${otherUserColumn})
  )`;
}
