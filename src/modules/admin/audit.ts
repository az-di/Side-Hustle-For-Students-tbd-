import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { notAllowed } from "@/lib/errors";
import type { Tx } from "@/lib/tx";

/**
 * The one door for admin writes.
 *
 * `withAudit` checks the actor is an admin, runs the change and writes the
 * audit row in the SAME transaction, so there is no admin action without a
 * log line and no log line for an action that rolled back. The audit payload
 * is a required argument: forgetting it is a type error, not a code review
 * finding.
 */

export type AuditEntry = {
  action: string;
  targetType: "report" | "user" | "tag" | "setting";
  targetId: string;
  payload: Record<string, unknown>;
};

export async function assertAdmin(userId: string, tx: Tx = db): Promise<void> {
  const admin = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true, status: true } });
  if (!admin?.isAdmin || admin.status !== "ACTIVE") throw notAllowed("Admins only.");
}

export async function withAudit<T>(adminUserId: string, entry: AuditEntry, fn: (tx: Tx) => Promise<T>): Promise<T> {
  await assertAdmin(adminUserId);

  return db.$transaction(async (tx) => {
    const result = await fn(tx);
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        payload: entry.payload as Prisma.InputJsonValue,
      },
    });
    return result;
  });
}
