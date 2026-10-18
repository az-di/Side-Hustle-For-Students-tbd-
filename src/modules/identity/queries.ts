import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Reads about people that are not catalog, trust or messaging concerns:
 * lookups by handle, demo personas, the seller settings page.
 */

export async function getUserByHandle(handle: string) {
  return db.user.findUnique({
    where: { handle },
    select: { id: true, handle: true, displayName: true, status: true, sellerProfile: { select: { isAvailable: true } } },
  });
}

export async function getUserIdByHandle(handle: string): Promise<string | null> {
  const row = await db.user.findUnique({ where: { handle }, select: { id: true } });
  return row?.id ?? null;
}

/** DEMO_MODE personas for the switcher and the login page. */
export async function listDemoPersonas(limit = 15) {
  return db.user.findMany({
    where: { isDemo: true },
    select: {
      handle: true,
      displayName: true,
      uwEmail: true,
      sellerProfile: { select: { headline: true, isAvailable: true } },
    },
    orderBy: { displayName: "asc" },
    take: limit,
  });
}

/** The one demo persona a DEMO_MODE sign-in may become. Null outside demo data. */
export async function findDemoPersona(handle: string): Promise<{ id: string } | null> {
  return db.user.findFirst({
    where: { handle, isDemo: true, uwEmail: { endsWith: `@${env.ALLOWED_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
}

/** Everything the seller settings page edits, in one read. */
export async function getSellerSettings(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      displayName: true,
      bio: true,
      venmoHandle: true,
      sellerProfile: {
        select: {
          headline: true,
          about: true,
          isAvailable: true,
          fixedPriceCents: true,
          hourlyRateCents: true,
          portfolioLinks: true,
        },
      },
      sellerTags: { select: { tag: { select: { id: true, name: true, slug: true, kind: true } } } },
      listings: {
        select: {
          id: true,
          title: true,
          description: true,
          fixedPriceCents: true,
          hourlyRateCents: true,
          turnaroundDays: true,
          tags: { select: { tag: { select: { id: true, name: true, slug: true, kind: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
