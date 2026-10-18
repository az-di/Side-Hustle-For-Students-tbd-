import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { conflict, invalid, notAllowed, notFound } from "@/lib/errors";
import { notify } from "@/modules/notifications/mutations";
import { applyJobEvent, isAutoCompleteDue, type JobStateView } from "./state";

type JobRow = JobStateView & { id: string; threadId: string | null };

async function loadJob(jobId: string): Promise<JobRow> {
  const row = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      buyerUserId: true,
      sellerUserId: true,
      completionRequestedById: true,
      autoCompleteAt: true,
      thread: { select: { id: true } },
    },
  });
  if (!row) throw notFound("That job");
  return { ...row, threadId: row.thread?.id ?? null };
}

/**
 * Have both people actually spoken in this job's thread?
 *
 * Guards MARK_COMPLETE. Without it, one party could mark a dead job complete,
 * wait out the auto-complete window and manufacture a completed job plus a
 * review slot with no work and no conversation.
 */
async function threadHasDialogue(jobId: string): Promise<boolean> {
  const senders = await db.message.findMany({
    where: { thread: { jobId }, senderUserId: { not: null } },
    select: { senderUserId: true },
    distinct: ["senderUserId"],
    take: 3,
  });
  return senders.length >= 2;
}

/**
 * The clock is injectable (`clock.now`, `clock.autoCompleteMs`) so the 7-day
 * window is testable in milliseconds. Production callers pass nothing.
 */
export type JobClock = { now?: Date; autoCompleteMs?: number };

export async function markJobComplete(params: { jobId: string; actorUserId: string }, clock: JobClock = {}): Promise<void> {
  const now = clock.now ?? new Date();
  const job = await loadJob(params.jobId);
  const decision = applyJobEvent(
    job,
    "MARK_COMPLETE",
    { userId: params.actorUserId, threadHasDialogue: await threadHasDialogue(params.jobId) },
    now,
  );
  if (!decision.ok) throw notAllowed(decision.message);

  const otherParty = params.actorUserId === job.buyerUserId ? job.sellerUserId : job.buyerUserId;
  const autoCompleteAt = new Date(now.getTime() + (clock.autoCompleteMs ?? env.AUTO_COMPLETE_MS));

  await db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: params.jobId, status: "IN_PROGRESS" },
      data: {
        status: "AWAITING_CONFIRMATION",
        completionRequestedById: params.actorUserId,
        completionRequestedAt: new Date(),
        autoCompleteAt,
      },
    });
    if (updated.count === 0) throw conflict("This job already moved on.");

    if (job.threadId) {
      await tx.message.create({
        data: {
          threadId: job.threadId,
          systemKind: "COMPLETION_REQUESTED",
          body: "Marked as complete — waiting for the other person to confirm.",
        },
      });
    }

    await notify(tx, {
      userId: otherParty,
      kind: "COMPLETION_REQUESTED",
      dedupeKey: `completion_requested:${params.jobId}:${params.actorUserId}`,
      actorUserId: params.actorUserId,
      jobId: params.jobId,
      threadId: job.threadId,
    });
  });
}

export async function confirmJobComplete(params: { jobId: string; actorUserId: string }): Promise<void> {
  const job = await loadJob(params.jobId);
  const decision = applyJobEvent(job, "CONFIRM_COMPLETE", { userId: params.actorUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  await db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: params.jobId, status: "AWAITING_CONFIRMATION" },
      data: { status: "COMPLETED", completedAt: new Date(), completionSource: "MUTUAL" },
    });
    if (updated.count === 0) throw conflict("This job already moved on.");

    // Only mutual completions count towards the public number on a profile.
    await tx.sellerProfile.update({
      where: { userId: job.sellerUserId },
      data: { completedJobCount: { increment: 1 } },
    });

    if (job.threadId) {
      await tx.message.create({
        data: {
          threadId: job.threadId,
          systemKind: "COMPLETION_CONFIRMED",
          body: "Both sides marked this job complete.",
        },
      });
    }

    await notify(tx, [
      {
        userId: job.buyerUserId,
        kind: "JOB_COMPLETED",
        dedupeKey: `job_completed:${params.jobId}:${job.buyerUserId}`,
        jobId: params.jobId,
        threadId: job.threadId,
      },
      {
        userId: job.sellerUserId,
        kind: "JOB_COMPLETED",
        dedupeKey: `job_completed:${params.jobId}:${job.sellerUserId}`,
        jobId: params.jobId,
        threadId: job.threadId,
      },
    ]);
  });
}

export async function rejectJobCompletion(params: { jobId: string; actorUserId: string }): Promise<void> {
  const job = await loadJob(params.jobId);
  const decision = applyJobEvent(job, "REJECT_COMPLETION", { userId: params.actorUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  await db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: params.jobId, status: "AWAITING_CONFIRMATION" },
      data: {
        status: "IN_PROGRESS",
        completionRequestedById: null,
        completionRequestedAt: null,
        autoCompleteAt: null,
      },
    });
    if (updated.count === 0) throw conflict("This job already moved on.");

    if (job.threadId) {
      await tx.message.create({
        data: {
          threadId: job.threadId,
          systemKind: "COMPLETION_REQUESTED",
          body: "Not done yet — this job is back in progress.",
        },
      });
    }
  });
}

/**
 * Writes down an auto-completion that has already happened.
 *
 * Auto-completion is DERIVED (see effectiveJobStatus), so the UI is correct the
 * instant the window passes. This materializes the row and sends the
 * notifications, and is called whenever anyone opens the job — which is why
 * this build needs no cron for correctness.
 *
 * `completionSource = AUTO` and a separate counter keep it honest: an
 * auto-completed job does not inflate the public completed-job count.
 */
export async function materializeAutoComplete(jobId: string, now: Date = new Date()): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!isAutoCompleteDue(job, now)) return false;

  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: jobId, status: "AWAITING_CONFIRMATION" },
      data: { status: "COMPLETED", completedAt: new Date(), completionSource: "AUTO" },
    });
    if (updated.count === 0) return false;

    await tx.sellerProfile.update({
      where: { userId: job.sellerUserId },
      data: { autoCompletedCount: { increment: 1 } },
    });

    if (job.threadId) {
      await tx.message.create({
        data: {
          threadId: job.threadId,
          systemKind: "JOB_AUTO_COMPLETED",
          body: "Auto-confirmed after the confirmation window passed.",
        },
      });
    }

    await notify(tx, [
      {
        userId: job.buyerUserId,
        kind: "JOB_AUTO_COMPLETED",
        dedupeKey: `job_auto:${jobId}:${job.buyerUserId}`,
        jobId,
        threadId: job.threadId,
      },
      {
        userId: job.sellerUserId,
        kind: "JOB_AUTO_COMPLETED",
        dedupeKey: `job_auto:${jobId}:${job.sellerUserId}`,
        jobId,
        threadId: job.threadId,
      },
    ]);

    return true;
  });
}

export async function cancelJob(params: { jobId: string; actorUserId: string }): Promise<void> {
  const job = await loadJob(params.jobId);
  const decision = applyJobEvent(job, "CANCEL", { userId: params.actorUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  const otherParty = params.actorUserId === job.buyerUserId ? job.sellerUserId : job.buyerUserId;

  await db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: params.jobId, status: { in: ["IN_PROGRESS", "AWAITING_CONFIRMATION"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: params.actorUserId },
    });
    if (updated.count === 0) throw conflict("This job already moved on.");

    if (job.threadId) {
      await tx.message.create({
        data: { threadId: job.threadId, systemKind: "JOB_CANCELLED", body: "This job was cancelled." },
      });
    }

    await notify(tx, {
      userId: otherParty,
      kind: "JOB_CANCELLED",
      dedupeKey: `job_cancelled:${params.jobId}`,
      actorUserId: params.actorUserId,
      jobId: params.jobId,
      threadId: job.threadId,
    });
  });
}

/**
 * The buyer reviews the seller. Buyers only, completed jobs only — the spec is
 * explicit that sellers do not review buyers.
 *
 * The rating average is recomputed inside the same transaction as the insert,
 * so a profile can never show a rating that disagrees with its reviews.
 */
export async function createReview(params: {
  jobId: string;
  buyerUserId: string;
  rating: number;
  body: string | null;
}): Promise<void> {
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    throw invalid("Pick a rating from 1 to 5 stars.");
  }

  // An auto-completed job is reviewable too, so materialize first and then
  // judge the stored status.
  await materializeAutoComplete(params.jobId).catch(() => false);

  const job = await db.job.findUnique({
    where: { id: params.jobId },
    select: {
      id: true,
      status: true,
      buyerUserId: true,
      sellerUserId: true,
      review: { select: { id: true } },
      thread: { select: { id: true } },
    },
  });
  if (!job) throw notFound("That job");
  if (job.buyerUserId !== params.buyerUserId) throw notAllowed("Only the buyer can review this job.");
  if (job.status !== "COMPLETED") throw notAllowed("You can review once the job is complete.");
  if (job.review) throw conflict("You have already reviewed this job.");

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        jobId: job.id,
        buyerUserId: job.buyerUserId,
        sellerUserId: job.sellerUserId,
        rating: params.rating,
        body: params.body,
      },
    });

    const agg = await tx.review.aggregate({
      where: { sellerUserId: job.sellerUserId },
      _avg: { rating: true },
      _count: true,
    });

    await tx.sellerProfile.update({
      where: { userId: job.sellerUserId },
      data: { ratingAvg: agg._avg.rating, ratingCount: agg._count },
    });

    await notify(tx, {
      userId: job.sellerUserId,
      kind: "REVIEW_RECEIVED",
      dedupeKey: `review:${job.id}`,
      actorUserId: job.buyerUserId,
      jobId: job.id,
      threadId: job.thread?.id ?? null,
    });
  });
}
