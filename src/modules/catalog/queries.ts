import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { blockedUserIds } from "@/modules/trust/block-filter";

/** Mirrors the normalization used when seeding searchTerms. One source of truth. */
export function normalizeTerm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type TagHit = { id: string; name: string; kind: "SERVICE" | "COURSE"; slug: string };

/**
 * Tag typeahead.
 *
 * Matches against Tag.searchTerms, which holds the display name plus the hidden
 * synonym list — so "photoshoot" finds Photography and "calc 2" finds MATH 125.
 * Three match shapes, scored so the best lands on top:
 *
 *   exact term        1.0
 *   compact exact     0.95   ("math124" -> "math 124")
 *   prefix            0.8
 *   word-prefix       0.6    (matches "senior photos" when typing "photos")
 *
 * The response carries id/name/kind/slug and NEVER the term that matched:
 * echoing it back would let anyone enumerate the hidden synonyms by probing.
 *
 * At ~35 tags this is a sub-millisecond sequential scan. It stays correct (just
 * slower) up to tens of thousands of tags, at which point this becomes a
 * pg_trgm GIN index over a flattened term table.
 */
export async function searchTags(query: string, limit = 10): Promise<TagHit[]> {
  const n = normalizeTerm(query);
  if (n.length === 0) return [];
  const compact = n.replace(/\s+/g, "");

  return db.$queryRaw<TagHit[]>(Prisma.sql`
    SELECT t."id", t."name", t."kind", t."slug",
      MAX(
        CASE
          WHEN term = ${n}                                  THEN 1.00
          WHEN replace(term, ' ', '') = ${compact}          THEN 0.95
          WHEN term LIKE ${n + "%"}                         THEN 0.80
          WHEN replace(term, ' ', '') LIKE ${compact + "%"} THEN 0.70
          WHEN term LIKE ${"% " + n + "%"}                  THEN 0.60
          ELSE 0
        END
      ) AS score
    FROM "Tag" t, unnest(t."searchTerms") AS term
    WHERE t."isActive"
    GROUP BY t."id", t."name", t."kind", t."slug", t."sortOrder"
    HAVING MAX(
      CASE
        WHEN term = ${n}                                  THEN 1.00
        WHEN replace(term, ' ', '') = ${compact}          THEN 0.95
        WHEN term LIKE ${n + "%"}                         THEN 0.80
        WHEN replace(term, ' ', '') LIKE ${compact + "%"} THEN 0.70
        WHEN term LIKE ${"% " + n + "%"}                  THEN 0.60
        ELSE 0
      END
    ) > 0
    ORDER BY score DESC, (t."kind" = 'SERVICE') DESC, t."sortOrder", t."name"
    LIMIT ${limit}
  `);
}

export async function getTagBySlug(slug: string) {
  return db.tag.findUnique({ where: { slug }, select: { id: true, name: true, kind: true, slug: true } });
}

/**
 * Course tags grouped by subject ("MATH", "CSE", …), for the seller tag
 * editor's bulk-select. Only active tags; sorted so numbers read in order.
 */
export async function listCourseTagsBySubject(): Promise<
  { subject: string; tags: { id: string; name: string; slug: string; kind: "COURSE" }[] }[]
> {
  const rows = await db.tag.findMany({
    where: { kind: "COURSE", isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const groups = new Map<string, { id: string; name: string; slug: string; kind: "COURSE" }[]>();
  for (const row of rows) {
    const subject = row.name.replace(/\s*\d.*$/, "").trim() || "Other";
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject)!.push({ ...row, kind: "COURSE" });
  }

  return [...groups.entries()]
    .map(([subject, tags]) => ({ subject, tags }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export async function listServiceTags() {
  return db.tag.findMany({
    where: { kind: "SERVICE", isActive: true },
    select: { id: true, name: true, slug: true, kind: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Sellers for a tag, best first.
 *
 * Paused sellers are still LISTED (the spec is explicit: they stay visible and
 * just receive no new requests), so they are returned with isAvailable false
 * and the UI badges them. Suspended sellers and anyone blocked by (or
 * blocking) the viewer are not listed.
 */
export async function listSellersForTag(params: { tagId: string; minRating?: number; viewerId?: string | null }) {
  const hidden = params.viewerId ? await blockedUserIds(params.viewerId) : [];
  const sellers = await db.sellerProfile.findMany({
    where: {
      user: { sellerTags: { some: { tagId: params.tagId } }, status: "ACTIVE" },
      ...(hidden.length > 0 ? { userId: { notIn: hidden } } : {}),
      ...(params.minRating ? { ratingAvg: { gte: params.minRating } } : {}),
    },
    select: {
      userId: true,
      headline: true,
      isAvailable: true,
      fixedPriceCents: true,
      hourlyRateCents: true,
      ratingAvg: true,
      ratingCount: true,
      completedJobCount: true,
      user: { select: { handle: true, displayName: true } },
    },
    orderBy: [{ isAvailable: "desc" }, { ratingAvg: { sort: "desc", nulls: "last" } }, { completedJobCount: "desc" }],
    take: 50,
  });

  return sellers.map((s) => ({
    userId: s.userId,
    handle: s.user.handle,
    displayName: s.user.displayName,
    headline: s.headline,
    isAvailable: s.isAvailable,
    // Seller-authored prices are stored NET, so they pass through untouched.
    fixedPriceCents: s.fixedPriceCents,
    hourlyRateCents: s.hourlyRateCents,
    ratingAvg: s.ratingAvg,
    ratingCount: s.ratingCount,
    completedJobCount: s.completedJobCount,
  }));
}

export async function getSellerByHandle(handle: string) {
  const user = await db.user.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      status: true,
      createdAt: true,
      sellerProfile: {
        select: {
          headline: true,
          about: true,
          isAvailable: true,
          fixedPriceCents: true,
          hourlyRateCents: true,
          portfolioLinks: true,
          ratingAvg: true,
          ratingCount: true,
          completedJobCount: true,
        },
      },
      sellerTags: {
        select: { tag: { select: { id: true, name: true, slug: true, kind: true } } },
        orderBy: { tag: { sortOrder: "asc" } },
      },
      listings: {
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          description: true,
          fixedPriceCents: true,
          hourlyRateCents: true,
          turnaroundDays: true,
          tags: { select: { tag: { select: { name: true, slug: true, kind: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviewsReceived: {
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          buyer: { select: { displayName: true, handle: true } },
          job: { select: { completionSource: true, request: { select: { title: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) return null;

  return {
    ...user,
    tags: user.sellerTags.map((st) => st.tag),
    reviews: user.reviewsReceived,
  };
}

export async function getListingById(id: string) {
  return db.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      fixedPriceCents: true,
      hourlyRateCents: true,
      turnaroundDays: true,
      sellerUserId: true,
      seller: {
        select: {
          handle: true,
          displayName: true,
          sellerProfile: { select: { isAvailable: true, ratingAvg: true, ratingCount: true } },
        },
      },
      tags: { select: { tag: { select: { id: true, name: true, slug: true, kind: true } } } },
    },
  });
}
