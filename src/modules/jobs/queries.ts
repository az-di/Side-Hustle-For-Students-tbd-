import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { netFromGrossOrNull } from "@/lib/money";
import { effectiveJobStatus, isReviewable } from "./state";
import { materializeAutoComplete } from "./mutations";

/**
 * Job views, one per role.
 *
 * `JobForSeller` has payout fields only — there is no field on it that could
 * hold the buyer's budget. `JobForBuyer` carries both numbers, because the
 * buyer needs to know what to Venmo.
 *
 * Both carry the counterparty's Venmo handle, which is PII: it is selected only
 * here, for the two people actually on the job, and never appears on a profile
 * or in search.
 */

type Party = { id: string; handle: string; displayName: string; venmoHandle: string | null };

export type JobForSeller = {
  role: "SELLER";
  id: string;
  status: ReturnType<typeof effectiveJobStatus>;
  title: string;
  payoutFixedCents: number | null;
  payoutHourlyCents: number | null;
  buyer: Party;
  threadId: string | null;
  completionRequestedById: string | null;
  autoCompleteAt: string | null;
  completedAt: string | null;
  completionSource: "MUTUAL" | "AUTO" | null;
  review: { rating: number; body: string | null } | null;
};

export type JobForBuyer = Omit<JobForSeller, "role" | "payoutFixedCents" | "payoutHourlyCents" | "buyer"> & {
  role: "BUYER";
  budgetFixedCents: number | null;
  budgetHourlyCents: number | null;
  payTheSellerFixedCents: number | null;
  payTheSellerHourlyCents: number | null;
  feeBps: number;
  seller: Party;
  canReview: boolean;
};

const JOB_SELECT = {
  id: true,
  status: true,
  buyerUserId: true,
  sellerUserId: true,
  agreedGrossFixedCents: true,
  agreedGrossHourlyCents: true,
  feeBps: true,
  completionRequestedById: true,
  autoCompleteAt: true,
  completedAt: true,
  completionSource: true,
  request: { select: { title: true } },
  thread: { select: { id: true } },
  review: { select: { rating: true, body: true } },
  buyer: { select: { id: true, handle: true, displayName: true, venmoHandle: true } },
  seller: { select: { id: true, handle: true, displayName: true, venmoHandle: true } },
} as const;

export async function getJobForViewer(jobId: string, viewerId: string): Promise<JobForSeller | JobForBuyer> {
  // Opening a job is what writes down an overdue auto-completion. This is the
  // "derive, then materialize" half that replaces a cron sweep.
  await materializeAutoComplete(jobId).catch(() => false);

  const row = await db.job.findUnique({ where: { id: jobId }, select: JOB_SELECT });
  if (!row) throw notFound("That job");

  const isBuyer = row.buyerUserId === viewerId;
  const isSeller = row.sellerUserId === viewerId;
  if (!isBuyer && !isSeller) throw notFound("That job");

  const now = new Date();
  const status = effectiveJobStatus(row, now);

  const common = {
    id: row.id,
    status,
    title: row.request.title,
    threadId: row.thread?.id ?? null,
    completionRequestedById: row.completionRequestedById,
    autoCompleteAt: row.autoCompleteAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completionSource: row.completionSource,
    review: row.review,
  };

  if (isSeller) {
    return {
      ...common,
      role: "SELLER",
      // The only money a seller is shown: their own take-home.
      payoutFixedCents: netFromGrossOrNull(row.agreedGrossFixedCents, row.feeBps),
      payoutHourlyCents: netFromGrossOrNull(row.agreedGrossHourlyCents, row.feeBps),
      buyer: row.buyer,
    };
  }

  return {
    ...common,
    role: "BUYER",
    budgetFixedCents: row.agreedGrossFixedCents,
    budgetHourlyCents: row.agreedGrossHourlyCents,
    // What they actually hand over in v1 — the net figure, same as the seller saw.
    payTheSellerFixedCents: netFromGrossOrNull(row.agreedGrossFixedCents, row.feeBps),
    payTheSellerHourlyCents: netFromGrossOrNull(row.agreedGrossHourlyCents, row.feeBps),
    feeBps: row.feeBps,
    seller: row.seller,
    canReview: isReviewable(row, now) && row.review === null,
  };
}

export async function listJobsForUser(userId: string) {
  const rows = await db.job.findMany({
    where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
    select: {
      id: true,
      status: true,
      buyerUserId: true,
      sellerUserId: true,
      agreedGrossFixedCents: true,
      agreedGrossHourlyCents: true,
      feeBps: true,
      autoCompleteAt: true,
      createdAt: true,
      completionSource: true,
      request: { select: { title: true } },
      review: { select: { id: true } },
      buyer: { select: { handle: true, displayName: true } },
      seller: { select: { handle: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = new Date();
  return rows.map((row) => {
    const isSeller = row.sellerUserId === userId;
    return {
      id: row.id,
      title: row.request.title,
      status: effectiveJobStatus(row, now),
      role: isSeller ? ("SELLER" as const) : ("BUYER" as const),
      counterparty: isSeller ? row.buyer : row.seller,
      // Sellers see net; buyers see what they owe, which is also net in v1.
      amountCents: netFromGrossOrNull(row.agreedGrossFixedCents ?? row.agreedGrossHourlyCents, row.feeBps),
      isHourly: row.agreedGrossFixedCents === null && row.agreedGrossHourlyCents !== null,
      needsReview: !isSeller && effectiveJobStatus(row, now) === "COMPLETED" && row.review === null,
      createdAt: row.createdAt,
    };
  });
}
