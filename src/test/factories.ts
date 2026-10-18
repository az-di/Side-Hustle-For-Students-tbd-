import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE, hashSessionToken, newSessionToken } from "@/lib/session-token";

/**
 * Row factories for integration tests. Everything is tagged with a run id so
 * `cleanup()` can delete exactly what a test created, and nothing else —
 * these run against a real (possibly seeded) database.
 */

const runId = randomBytes(4).toString("hex");
const created = { userIds: [] as string[], tagIds: [] as string[] };

export function uniq(prefix: string): string {
  return `${prefix}-${runId}-${randomBytes(3).toString("hex")}`;
}

export async function makeUser(opts: { seller?: boolean; tagIds?: string[]; isAdmin?: boolean } = {}) {
  const handle = uniq("t").replace(/-/g, "").slice(0, 28);
  const user = await db.user.create({
    data: {
      uwEmail: `${handle}@uw.edu`,
      handle,
      displayName: `Test ${handle.slice(-4)}`,
      isAdmin: opts.isAdmin ?? false,
      ...(opts.seller
        ? {
            sellerProfile: { create: { headline: "test seller" } },
            sellerTags: { create: (opts.tagIds ?? []).map((tagId) => ({ tagId })) },
          }
        : {}),
    },
    select: { id: true, handle: true },
  });
  created.userIds.push(user.id);
  return user;
}

export async function makeTag() {
  const slug = uniq("tag");
  const tag = await db.tag.create({
    data: { kind: "SERVICE", slug, name: slug, searchTerms: [slug], sortOrder: 999 },
    select: { id: true, slug: true },
  });
  created.tagIds.push(tag.id);
  return tag;
}

/**
 * Mints a session for a user and returns the Cookie header that presents it,
 * so an HTTP test can fetch pages as that person without the OTP dance.
 */
export async function signInAs(userId: string): Promise<string> {
  const token = newSessionToken();
  await db.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return `${SESSION_COOKIE}=${token}`;
}

/** Deletes every user and tag this run created. Cascades take the rest. */
export async function cleanup(): Promise<void> {
  // Requests first: deleting a seller would SET NULL the target of a DIRECT
  // request, which the request_direct_target CHECK refuses.
  await db.request.deleteMany({
    where: { OR: [{ buyerUserId: { in: created.userIds } }, { targetSellerUserId: { in: created.userIds } }] },
  });
  await db.user.deleteMany({ where: { id: { in: created.userIds } } });
  await db.tag.deleteMany({ where: { id: { in: created.tagIds } } });
  created.userIds = [];
  created.tagIds = [];
}
