import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";

/**
 * Seller profile, tag and listing writes. All seller-authored prices are NET
 * (what they take home) and are stored exactly as typed — see src/lib/money.ts.
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
  await db.sellerProfile.update({
    where: { userId: params.userId },
    data: { isAvailable: !params.paused, pausedAt: params.paused ? new Date() : null },
  });
}

export async function setSellerTag(params: { userId: string; tagId: string; on: boolean }): Promise<void> {
  if (params.on) {
    await db.sellerTag.upsert({
      where: { sellerUserId_tagId: { sellerUserId: params.userId, tagId: params.tagId } },
      create: { sellerUserId: params.userId, tagId: params.tagId },
      update: {},
    });
  } else {
    await db.sellerTag.deleteMany({ where: { sellerUserId: params.userId, tagId: params.tagId } });
  }
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

    // Publishing a listing under a tag implies being open to that tag.
    await tx.sellerTag.createMany({
      data: input.tagIds.map((tagId) => ({ sellerUserId: input.sellerUserId, tagId })),
      skipDuplicates: true,
    });

    return { listingId: listing.id };
  });
}
