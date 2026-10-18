import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { notifyWatchers } from "@/modules/interests/mutations";

/**
 * Seller profile, tag and listing writes. All seller-authored prices are NET
 * (what they take home) and are stored exactly as typed — see src/lib/money.ts.
 *
 * Three of these are the "a seller became open to a tag" triggers — adding a
 * tag, resuming from pause, publishing a listing — and all three funnel
 * through notifyWatchers() inside the same transaction.
 */

const MAX_PORTFOLIO_LINKS = 10;

export async function becomeSeller(params: { userId: string; headline: string | null }): Promise<void> {
  await db.sellerProfile.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, headline: params.headline },
    update: { headline: params.headline },
  });
}

export async function setSellerPaused(params: { userId: string; paused: boolean }): Promise<void> {
  await db.$transaction(async (tx) => {
    const updated = await tx.sellerProfile.updateMany({
      // The guard makes a repeated "Resume" a no-op, so it cannot re-trigger alerts.
      where: { userId: params.userId, isAvailable: params.paused },
      data: { isAvailable: !params.paused, pausedAt: params.paused ? new Date() : null },
    });
    if (updated.count === 0 || params.paused) return;

    const tags = await tx.sellerTag.findMany({ where: { sellerUserId: params.userId }, select: { tagId: true } });
    await notifyWatchers(tx, { sellerUserId: params.userId, tagIds: tags.map((t) => t.tagId) });
  });
}

/**
 * Bulk add ("all MATH"). Only tags the seller did not already hold are
 * announced to watchers, and a tag they already have is left alone.
 */
export async function addSellerTags(params: { userId: string; tagIds: string[] }): Promise<{ added: number }> {
  const unique = [...new Set(params.tagIds)];
  if (unique.length === 0) return { added: 0 };

  return db.$transaction(async (tx) => {
    const had = new Set(
      (await tx.sellerTag.findMany({ where: { sellerUserId: params.userId, tagId: { in: unique } }, select: { tagId: true } })).map(
        (t) => t.tagId,
      ),
    );
    const fresh = unique.filter((id) => !had.has(id));
    if (fresh.length === 0) return { added: 0 };

    await tx.sellerTag.createMany({ data: fresh.map((tagId) => ({ sellerUserId: params.userId, tagId })), skipDuplicates: true });
    await notifyWatchers(tx, { sellerUserId: params.userId, tagIds: fresh });
    return { added: fresh.length };
  });
}

export async function setSellerTag(params: { userId: string; tagId: string; on: boolean }): Promise<void> {
  if (!params.on) {
    await db.sellerTag.deleteMany({ where: { sellerUserId: params.userId, tagId: params.tagId } });
    return;
  }

  await db.$transaction(async (tx) => {
    const created = await tx.sellerTag.createMany({
      data: [{ sellerUserId: params.userId, tagId: params.tagId }],
      skipDuplicates: true,
    });
    if (created.count === 0) return; // already had it: nothing new to announce
    await notifyWatchers(tx, { sellerUserId: params.userId, tagIds: [params.tagId] });
  });
}

export type SellerProfileInput = {
  userId: string;
  displayName: string;
  bio: string | null;
  headline: string | null;
  about: string | null;
  venmoHandle: string | null;
  /** NET cents, or null to clear. */
  fixedPriceCents: number | null;
  hourlyRateCents: number | null;
  portfolioLinks: string[];
};

export async function saveSellerProfile(input: SellerProfileInput): Promise<void> {
  const links = input.portfolioLinks.map((l) => l.trim()).filter((l) => l.length > 0).slice(0, MAX_PORTFOLIO_LINKS);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { displayName: input.displayName, bio: input.bio, venmoHandle: input.venmoHandle },
    });

    await tx.sellerProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        headline: input.headline,
        about: input.about,
        fixedPriceCents: input.fixedPriceCents,
        hourlyRateCents: input.hourlyRateCents,
        portfolioLinks: links,
      },
      update: {
        headline: input.headline,
        about: input.about,
        fixedPriceCents: input.fixedPriceCents,
        hourlyRateCents: input.hourlyRateCents,
        portfolioLinks: links,
      },
    });
  });
}

export type ListingInput = {
  sellerUserId: string;
  listingId?: string | null;
  title: string;
  description: string;
  fixedPriceCents: number | null;
  hourlyRateCents: number | null;
  turnaroundDays: number | null;
  tagIds: string[];
};

export async function saveListing(input: ListingInput): Promise<{ listingId: string }> {
  if (input.fixedPriceCents === null && input.hourlyRateCents === null) {
    throw invalid("Set a flat price, an hourly rate, or both.");
  }
  if (input.tagIds.length === 0) throw invalid("Pick at least one tag.");

  return db.$transaction(async (tx) => {
    const data = {
      title: input.title,
      description: input.description,
      fixedPriceCents: input.fixedPriceCents,
      hourlyRateCents: input.hourlyRateCents,
      turnaroundDays: input.turnaroundDays,
    };

    const listing = input.listingId
      ? await tx.listing.update({
          // The seller id in the where clause is what stops editing someone else's listing.
          where: { id: input.listingId, sellerUserId: input.sellerUserId },
          data,
          select: { id: true },
        })
      : await tx.listing.create({ data: { ...data, sellerUserId: input.sellerUserId }, select: { id: true } });

    await tx.listingTag.deleteMany({ where: { listingId: listing.id } });
    await tx.listingTag.createMany({
      data: input.tagIds.map((tagId) => ({ listingId: listing.id, tagId })),
      skipDuplicates: true,
    });

    // Publishing a listing under a tag implies being open to that tag. Only
    // tags that are NEW to this seller count as "opening up".
    const had = new Set(
      (await tx.sellerTag.findMany({ where: { sellerUserId: input.sellerUserId }, select: { tagId: true } })).map(
        (t) => t.tagId,
      ),
    );
    await tx.sellerTag.createMany({
      data: input.tagIds.map((tagId) => ({ sellerUserId: input.sellerUserId, tagId })),
      skipDuplicates: true,
    });
    await notifyWatchers(tx, {
      sellerUserId: input.sellerUserId,
      tagIds: input.tagIds.filter((tagId) => !had.has(tagId)),
    });

    return { listingId: listing.id };
  });
}
