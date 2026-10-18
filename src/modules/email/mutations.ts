import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { unsubscribeToken } from "./templates";

export async function setEmailOptOut(params: { userId: string; optOut: boolean }): Promise<void> {
  await db.user.update({ where: { id: params.userId }, data: { emailOptOut: params.optOut } });
}

/**
 * One-click unsubscribe from a link. No session: the token is an HMAC over the
 * user's private key, compared in constant time. Returns false for any bad
 * input rather than saying which part was wrong.
 */
export async function unsubscribeWithToken(params: { userId: string; token: string }): Promise<boolean> {
  if (!params.userId || !params.token) return false;

  const user = await db.user.findUnique({ where: { id: params.userId }, select: { emailUnsubKey: true } });
  if (!user) return false;

  const expected = Buffer.from(unsubscribeToken(user.emailUnsubKey));
  const given = Buffer.from(params.token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  await db.user.update({ where: { id: params.userId }, data: { emailOptOut: true } });
  return true;
}
