import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_TAGS, PEOPLE } from "./seed-data";

/**
 * Idempotent seed: safe to run repeatedly. Everything is upserted by a natural
 * key (email, slug, title), so `npm run db:seed` twice does not duplicate.
 *
 * It also seeds a few COMPLETED jobs with reviews, because a marketplace with
 * blank profiles and no ratings looks broken on stage.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/** Mirrors src/lib/money.ts. Duplicated so the seed has no app-code imports. */
const netFromGross = (gross: number, feeBps = 1000) => Math.floor((gross * (10_000 - feeBps)) / 10_000);
const grossFromNet = (net: number, feeBps = 1000) => Math.ceil((net * 10_000) / (10_000 - feeBps));

async function main() {
  console.log("Seeding HUSTL…");

  // ── tags ────────────────────────────────────────────────────────────────
  for (const tag of ALL_TAGS) {
    await db.tag.upsert({
      where: { slug: tag.slug },
      create: {
        slug: tag.slug,
        name: tag.name,
        kind: tag.kind,
        searchTerms: tag.searchTerms.map((t) => t.toLowerCase()),
        sortOrder: tag.sortOrder ?? 200,
      },
      update: {
        name: tag.name,
        kind: tag.kind,
        searchTerms: tag.searchTerms.map((t) => t.toLowerCase()),
        sortOrder: tag.sortOrder ?? 200,
      },
    });
  }
  const tags = await db.tag.findMany({ select: { id: true, slug: true } });
  const tagId = new Map(tags.map((t) => [t.slug, t.id]));
  console.log(`  ${tags.length} tags`);

  // ── people, seller profiles, listings ───────────────────────────────────
  const userId = new Map<string, string>();

  for (const person of PEOPLE) {
    const user = await db.user.upsert({
      where: { uwEmail: person.email },
      create: {
        uwEmail: person.email,
        handle: person.handle,
        displayName: person.displayName,
        bio: person.bio,
        venmoHandle: person.venmoHandle,
        isDemo: true,
      },
      update: {
        displayName: person.displayName,
        bio: person.bio,
        venmoHandle: person.venmoHandle,
        isDemo: true,
      },
      select: { id: true },
    });
    userId.set(person.email, user.id);

    if (!person.seller) continue;
    const s = person.seller;

    await db.sellerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        headline: s.headline,
        about: s.about,
        fixedPriceCents: s.fixedPriceCents,
        hourlyRateCents: s.hourlyRateCents,
        portfolioLinks: s.portfolioLinks,
        isAvailable: s.isAvailable ?? true,
        pausedAt: s.isAvailable === false ? new Date() : null,
      },
      update: {
        headline: s.headline,
        about: s.about,
        fixedPriceCents: s.fixedPriceCents,
        hourlyRateCents: s.hourlyRateCents,
        portfolioLinks: s.portfolioLinks,
        isAvailable: s.isAvailable ?? true,
      },
    });

    for (const slug of s.tagSlugs) {
      const id = tagId.get(slug);
      if (!id) throw new Error(`Unknown tag slug in seed data: ${slug}`);
      await db.sellerTag.upsert({
        where: { sellerUserId_tagId: { sellerUserId: user.id, tagId: id } },
        create: { sellerUserId: user.id, tagId: id },
        update: {},
      });
    }

    for (const listing of s.listings) {
      const existing = await db.listing.findFirst({
        where: { sellerUserId: user.id, title: listing.title },
        select: { id: true },
      });

      const row = existing
        ? await db.listing.update({
            where: { id: existing.id },
            data: {
              description: listing.description,
              fixedPriceCents: listing.fixedPriceCents,
              hourlyRateCents: listing.hourlyRateCents,
              turnaroundDays: listing.turnaroundDays,
            },
            select: { id: true },
          })
        : await db.listing.create({
            data: {
              sellerUserId: user.id,
              title: listing.title,
              description: listing.description,
              fixedPriceCents: listing.fixedPriceCents,
              hourlyRateCents: listing.hourlyRateCents,
              turnaroundDays: listing.turnaroundDays,
            },
            select: { id: true },
          });

      for (const slug of listing.tagSlugs) {
        const id = tagId.get(slug);
        if (!id) throw new Error(`Unknown tag slug in seed data: ${slug}`);
        await db.listingTag.upsert({
          where: { listingId_tagId: { listingId: row.id, tagId: id } },
          create: { listingId: row.id, tagId: id },
          update: {},
        });
      }
    }
  }
  console.log(`  ${userId.size} people`);

  // ── history: completed jobs + reviews, so profiles are not blank ────────
  const history: {
    buyer: string;
    seller: string;
    title: string;
    details: string;
    netCents: number;
    tagSlug: string;
    rating: number;
    review: string;
    daysAgo: number;
  }[] = [
    {
      buyer: "zoe@uw.edu",
      seller: "maya@uw.edu",
      title: "Photos for the ASUW fall welcome",
      details: "Two hours of candids at the HUB lawn event, plus a few posed shots of the officer team.",
      netCents: 9_000,
      tagSlug: "photography",
      rating: 5,
      review: "Maya showed up early, got everything we needed, and had the gallery to us in two days. Already booked her again.",
      daysAgo: 24,
    },
    {
      buyer: "alex@uw.edu",
      seller: "priya@uw.edu",
      title: "Poster for the climbing club send social",
      details: "Need a poster for the bouldering social, print and Instagram sizes.",
      netCents: 3_500,
      tagSlug: "graphic-design",
      rating: 5,
      review: "Turned it around in a day and it looked better than anything we have put up before.",
      daysAgo: 17,
    },
    {
      buyer: "zoe@uw.edu",
      seller: "jordan@uw.edu",
      title: "Recap reel for the spring showcase",
      details: "About 40 minutes of footage, need a 60 second recap for Instagram.",
      netCents: 5_000,
      tagSlug: "video-editing",
      rating: 4,
      review: "Good cut and great music choice. Took one extra day but he told us in advance.",
      daysAgo: 11,
    },
    {
      buyer: "alex@uw.edu",
      seller: "nina@uw.edu",
      title: "MATH 126 exam prep, two sessions",
      details: "Struggling with multivariable. Two hours before the midterm.",
      netCents: 6_000,
      tagSlug: "math-126",
      rating: 5,
      review: "Went from lost to actually understanding the material. Explained it three different ways until one stuck.",
      daysAgo: 6,
    },
    {
      buyer: "zoe@uw.edu",
      seller: "dev@uw.edu",
      title: "Render for a sponsorship deck",
      details: "Need a clean product render of our prototype for a sponsor pitch.",
      netCents: 7_500,
      tagSlug: "3d-modeling",
      rating: 5,
      review: "Dev asked the right questions up front and the render made our deck look professional.",
      daysAgo: 3,
    },
  ];

  let created = 0;
  for (const h of history) {
    const buyerId = userId.get(h.buyer)!;
    const sellerId = userId.get(h.seller)!;
    const tag = tagId.get(h.tagSlug)!;

    const already = await db.request.findFirst({
      where: { buyerUserId: buyerId, title: h.title },
      select: { id: true },
    });
    if (already) continue;

    const at = new Date(Date.now() - h.daysAgo * 24 * 60 * 60 * 1000);
    // Seed data is authored as the seller's take-home, so convert up to the
    // buyer's gross budget the same way the request form does.
    const gross = grossFromNet(h.netCents);

    const request = await db.request.create({
      data: {
        buyerUserId: buyerId,
        kind: "DIRECT",
        targetSellerUserId: sellerId,
        title: h.title,
        details: h.details,
        grossFixedBudgetCents: gross,
        status: "MATCHED",
        expiresAt: at,
        closedAt: at,
        createdAt: at,
        tags: { create: { tagId: tag } },
      },
      select: { id: true },
    });

    const job = await db.job.create({
      data: {
        requestId: request.id,
        buyerUserId: buyerId,
        sellerUserId: sellerId,
        agreedGrossFixedCents: gross,
        status: "COMPLETED",
        completedAt: at,
        completionSource: "MUTUAL",
        createdAt: at,
      },
      select: { id: true },
    });

    await db.thread.create({
      data: {
        kind: "JOB",
        buyerUserId: buyerId,
        sellerUserId: sellerId,
        requestId: request.id,
        jobId: job.id,
        lastMessageAt: at,
        createdAt: at,
        messages: {
          create: [
            { systemKind: "JOB_STARTED", body: "Job started.", createdAt: at },
            {
              senderUserId: buyerId,
              body: "Thanks again for doing this on short notice!",
              createdAt: new Date(at.getTime() + 60_000),
            },
            {
              senderUserId: sellerId,
              body: "Any time — everything is delivered, let me know if you need a tweak.",
              createdAt: new Date(at.getTime() + 120_000),
            },
            { systemKind: "COMPLETION_CONFIRMED", body: "Both sides marked this job complete.", createdAt: at },
          ],
        },
      },
    });

    await db.review.create({
      data: {
        jobId: job.id,
        buyerUserId: buyerId,
        sellerUserId: sellerId,
        rating: h.rating,
        body: h.review,
        createdAt: at,
      },
    });
    created++;
  }

  // Recompute denormalized seller stats from the rows we just wrote.
  for (const id of userId.values()) {
    const profile = await db.sellerProfile.findUnique({ where: { userId: id }, select: { userId: true } });
    if (!profile) continue;

    const [agg, completed] = await Promise.all([
      db.review.aggregate({ where: { sellerUserId: id }, _avg: { rating: true }, _count: true }),
      db.job.count({ where: { sellerUserId: id, status: "COMPLETED", completionSource: "MUTUAL" } }),
    ]);

    await db.sellerProfile.update({
      where: { userId: id },
      data: {
        ratingAvg: agg._avg.rating,
        ratingCount: agg._count,
        completedJobCount: completed,
      },
    });
  }
  console.log(`  ${created} completed jobs with reviews`);

  // ── one live open request, so the seller feed is not empty on first load ──
  const alex = userId.get("alex@uw.edu")!;
  const openExists = await db.request.findFirst({
    where: { buyerUserId: alex, status: "OPEN" },
    select: { id: true },
  });
  if (!openExists) {
    const gross = 8_000; // $80 ceiling -> sellers see $72
    await db.request.create({
      data: {
        buyerUserId: alex,
        kind: "OPEN",
        title: "Photographer for our winter banquet (Feb 7)",
        details:
          "Climbing club banquet at the HUB, about 2 hours, 60 people. Need candids and one big group shot. Evening, indoor lighting.",
        grossFixedBudgetCents: gross,
        status: "OPEN",
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        tags: { create: { tagId: tagId.get("photography")! } },
      },
    });
    console.log(`  1 open request ($${gross / 100} ceiling -> sellers see $${netFromGross(gross) / 100})`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
