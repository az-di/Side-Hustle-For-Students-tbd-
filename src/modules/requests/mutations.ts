import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, conflict, invalid, notAllowed, notFound } from "@/lib/errors";
import { grossFromNet } from "@/lib/money";
import { fanOutOpenRequest, notify } from "@/modules/notifications/mutations";
import { assertCanReach } from "@/modules/trust/mutations";
import { applyRequestEvent, type RequestStateView } from "./state";

/**
 * Request writes.
 *
 * Every mutation follows the same shape:
 *
 *   1. load the row
 *   2. ask the pure state machine whether the move is legal
 *   3. inside ONE transaction: write the row with an optimistic
 *      `WHERE status = <the status we decided on>` guard, then write the
 *      system message and notification rows
 *
 * Step 3's guard is what makes a double-click harmless: the second click
 * updates zero rows and raises CONFLICT instead of creating a second job.
 */

const MAX_TAGS_PER_REQUEST = 3;

type BudgetInput = { grossFixedBudgetCents: number | null; grossHourlyBudgetCents: number | null };

function assertBudget(budget: BudgetInput): void {
  if (budget.grossFixedBudgetCents === null && budget.grossHourlyBudgetCents === null) {
    throw invalid("Set a budget — either a flat amount or an hourly rate.");
  }
  for (const value of [budget.grossFixedBudgetCents, budget.grossHourlyBudgetCents]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
      throw invalid("A budget must be a positive amount.");
    }
  }
}

function assertTags(tagIds: string[]): void {
  if (tagIds.length === 0) throw invalid("Pick at least one tag so the right people see this.");
  if (tagIds.length > MAX_TAGS_PER_REQUEST) {
    throw invalid(`Pick at most ${MAX_TAGS_PER_REQUEST} tags.`);
  }
}

function expiryFrom(ttlMs: number | undefined): Date {
  const ms = ttlMs && ttlMs > 0 ? ttlMs : env.REQUEST_DEFAULT_TTL_MS;
  return new Date(Date.now() + ms);
}

export type CreateRequestInput = BudgetInput & {
  buyerUserId: string;
  title: string;
  details: string;
  tagIds: string[];
  ttlMs?: number;
  listingId?: string | null;
};

/** A request aimed at one seller. Only they see it. */
export async function createDirectRequest(
  input: CreateRequestInput & { targetSellerUserId: string },
): Promise<{ requestId: string; threadId: string }> {
  assertBudget(input);
  assertTags(input.tagIds);

  if (input.targetSellerUserId === input.buyerUserId) {
    throw invalid("You cannot send a request to yourself.");
  }

  // Blocks and suspension are checked here, at the point of contact, as well
  // as in every feed — a policy check cannot filter a list, and a list filter
  // cannot stop a direct URL.
  await assertCanReach(input.buyerUserId, input.targetSellerUserId);

  const seller = await db.sellerProfile.findUnique({
    where: { userId: input.targetSellerUserId },
    select: { isAvailable: true },
  });
  if (!seller) throw notFound("That seller");
  if (!seller.isAvailable) {
    throw new AppError("That seller is paused right now, so they are not taking new requests.", "PAUSED");
  }

  return db.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        buyerUserId: input.buyerUserId,
        kind: "DIRECT",
        targetSellerUserId: input.targetSellerUserId,
        listingId: input.listingId ?? null,
        title: input.title,
        details: input.details,
        grossFixedBudgetCents: input.grossFixedBudgetCents,
        grossHourlyBudgetCents: input.grossHourlyBudgetCents,
        status: "PENDING_SELLER",
        expiresAt: expiryFrom(input.ttlMs),
        tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      },
      select: { id: true },
    });

    const thread = await tx.thread.create({
      data: {
        kind: "REQUEST",
        buyerUserId: input.buyerUserId,
        sellerUserId: input.targetSellerUserId,
        requestId: request.id,
        messages: {
          // System messages carry NO money: a thread is read by both parties,
          // which makes it a seller-facing surface.
          create: { systemKind: "REQUEST_CREATED", body: "Request sent." },
        },
      },
      select: { id: true },
    });

    await notify(tx, {
      userId: input.targetSellerUserId,
      kind: "DIRECT_REQUEST_RECEIVED",
      dedupeKey: `direct_req:${request.id}`,
      actorUserId: input.buyerUserId,
      requestId: request.id,
      threadId: thread.id,
    });

    return { requestId: request.id, threadId: thread.id };
  });
}

/** A request broadcast to every seller holding one of its tags. */
export async function createOpenRequest(input: CreateRequestInput): Promise<{ requestId: string; notified: number }> {
  assertBudget(input);
  assertTags(input.tagIds);

  return db.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        buyerUserId: input.buyerUserId,
        kind: "OPEN",
        title: input.title,
        details: input.details,
        grossFixedBudgetCents: input.grossFixedBudgetCents,
        grossHourlyBudgetCents: input.grossHourlyBudgetCents,
        status: "OPEN",
        expiresAt: expiryFrom(input.ttlMs),
        tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      },
      select: { id: true },
    });

    const notified = await fanOutOpenRequest(tx, {
      requestId: request.id,
      buyerUserId: input.buyerUserId,
      tagIds: input.tagIds,
    });

    return { requestId: request.id, notified };
  });
}

/** Converts a listing's net price into the gross budget to prefill a request with. */
export function budgetFromListing(listing: {
  fixedPriceCents: number | null;
  hourlyRateCents: number | null;
}): BudgetInput {
  // The listing price is what the seller takes home, so it must be grossed up —
  // forget this and a $100 listing silently becomes $90 of work.
  return {
    grossFixedBudgetCents: listing.fixedPriceCents === null ? null : grossFromNet(listing.fixedPriceCents),
    grossHourlyBudgetCents: listing.hourlyRateCents === null ? null : grossFromNet(listing.hourlyRateCents),
  };
}

async function loadForTransition(requestId: string): Promise<RequestStateView & { id: string }> {
  const row = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      kind: true,
      buyerUserId: true,
      targetSellerUserId: true,
      expiresAt: true,
    },
  });
  if (!row) throw notFound("That request");
  return row;
}

/** A seller responds to an open request. The request itself stays open. */
export async function respondToOpenRequest(params: {
  requestId: string;
  sellerUserId: string;
  message: string;
}): Promise<{ responseId: string; threadId: string }> {
  const request = await loadForTransition(params.requestId);

  const [profile, existing] = await Promise.all([
    db.sellerProfile.findUnique({ where: { userId: params.sellerUserId }, select: { isAvailable: true } }),
    db.requestResponse.findUnique({
      where: { requestId_sellerUserId: { requestId: params.requestId, sellerUserId: params.sellerUserId } },
      select: { id: true },
    }),
  ]);

  const decision = applyRequestEvent(
    request,
    "SELLER_RESPOND",
    {
      userId: params.sellerUserId,
      isAvailableSeller: profile?.isAvailable ?? false,
      hasResponded: existing !== null,
    },
    new Date(),
  );
  if (!decision.ok) throw notAllowed(decision.message);
  await assertCanReach(params.sellerUserId, request.buyerUserId);

  return db.$transaction(async (tx) => {
    const response = await tx.requestResponse.create({
      data: {
        requestId: params.requestId,
        sellerUserId: params.sellerUserId,
        message: params.message,
      },
      select: { id: true },
    });

    // One thread per responder: several sellers may answer the same open
    // request, and they must not see each other.
    const thread = await tx.thread.create({
      data: {
        kind: "REQUEST",
        buyerUserId: request.buyerUserId,
        sellerUserId: params.sellerUserId,
        requestId: request.id,
        requestResponseId: response.id,
        messages: {
          create: [
            { systemKind: "RESPONSE_SENT", body: "Responded to this request." },
            { senderUserId: params.sellerUserId, body: params.message },
          ],
        },
      },
      select: { id: true },
    });

    await notify(tx, {
      userId: request.buyerUserId,
      kind: "RESPONSE_RECEIVED",
      dedupeKey: `response:${response.id}`,
      actorUserId: params.sellerUserId,
      requestId: request.id,
      threadId: thread.id,
    });

    return { responseId: response.id, threadId: thread.id };
  });
}

/**
 * The buyer picks a responder. The request closes for everyone else in the same
 * transaction, so it disappears from every other seller's feed at once.
 */
export async function selectResponse(params: {
  requestId: string;
  buyerUserId: string;
  responseId: string;
}): Promise<{ jobId: string; threadId: string }> {
  const request = await loadForTransition(params.requestId);
  const decision = applyRequestEvent(request, "BUYER_SELECT", { userId: params.buyerUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  const chosen = await db.requestResponse.findUnique({
    where: { id: params.responseId },
    select: { id: true, requestId: true, sellerUserId: true, status: true },
  });
  if (!chosen || chosen.requestId !== params.requestId) throw notFound("That response");
  if (chosen.status !== "PENDING") throw conflict("That response is no longer available.");
  await assertCanReach(params.buyerUserId, chosen.sellerUserId);

  const budget = await db.request.findUniqueOrThrow({
    where: { id: params.requestId },
    select: { grossFixedBudgetCents: true, grossHourlyBudgetCents: true, feeBps: true },
  });

  return db.$transaction(async (tx) => {
    // Optimistic guard: whichever click gets here first wins, the second sees
    // zero rows updated. The unique index on chosenResponseId is the backstop.
    const closed = await tx.request.updateMany({
      where: { id: params.requestId, status: "OPEN" },
      data: { status: "MATCHED", chosenResponseId: chosen.id, closedAt: new Date() },
    });
    if (closed.count === 0) throw conflict("Someone already closed this request.");

    await tx.requestResponse.update({ where: { id: chosen.id }, data: { status: "SELECTED" } });
    await tx.requestResponse.updateMany({
      where: { requestId: params.requestId, id: { not: chosen.id }, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });

    const job = await tx.job.create({
      data: {
        requestId: params.requestId,
        buyerUserId: request.buyerUserId,
        sellerUserId: chosen.sellerUserId,
        // Snapshot the agreed amounts so a later edit cannot rewrite history.
        agreedGrossFixedCents: budget.grossFixedBudgetCents,
        agreedGrossHourlyCents: budget.grossHourlyBudgetCents,
        feeBps: budget.feeBps,
      },
      select: { id: true },
    });

    const thread = await tx.thread.update({
      where: { requestResponseId: chosen.id },
      data: {
        kind: "JOB",
        jobId: job.id,
        lastMessageAt: new Date(),
        messages: { create: { systemKind: "JOB_STARTED", body: "You are working together — job started." } },
      },
      select: { id: true },
    });

    // Losing responders are told, and their threads are closed out.
    const losers = await tx.requestResponse.findMany({
      where: { requestId: params.requestId, id: { not: chosen.id } },
      select: { id: true, sellerUserId: true, thread: { select: { id: true } } },
    });

    for (const loser of losers) {
      if (loser.thread) {
        await tx.message.create({
          data: {
            threadId: loser.thread.id,
            systemKind: "REQUEST_CLOSED",
            body: "The buyer went with someone else for this one.",
          },
        });
      }
    }

    await notify(tx, [
      {
        userId: chosen.sellerUserId,
        kind: "RESPONSE_SELECTED",
        dedupeKey: `selected:${chosen.id}`,
        actorUserId: request.buyerUserId,
        requestId: params.requestId,
        jobId: job.id,
        threadId: thread.id,
      },
      ...losers.map((loser) => ({
        userId: loser.sellerUserId,
        kind: "RESPONSE_NOT_SELECTED" as const,
        dedupeKey: `not_selected:${loser.id}`,
        actorUserId: request.buyerUserId,
        requestId: params.requestId,
        threadId: loser.thread?.id ?? null,
      })),
    ]);

    return { jobId: job.id, threadId: thread.id };
  });
}

/** The targeted seller accepts a direct request, which starts the job. */
export async function acceptDirectRequest(params: {
  requestId: string;
  sellerUserId: string;
}): Promise<{ jobId: string; threadId: string }> {
  const request = await loadForTransition(params.requestId);
  const decision = applyRequestEvent(request, "SELLER_ACCEPT", { userId: params.sellerUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);
  await assertCanReach(params.sellerUserId, request.buyerUserId);

  const budget = await db.request.findUniqueOrThrow({
    where: { id: params.requestId },
    select: { grossFixedBudgetCents: true, grossHourlyBudgetCents: true, feeBps: true },
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.request.updateMany({
      where: { id: params.requestId, status: "PENDING_SELLER" },
      data: { status: "MATCHED", closedAt: new Date() },
    });
    if (updated.count === 0) throw conflict("This request already moved on.");

    const job = await tx.job.create({
      data: {
        requestId: params.requestId,
        buyerUserId: request.buyerUserId,
        sellerUserId: params.sellerUserId,
        agreedGrossFixedCents: budget.grossFixedBudgetCents,
        agreedGrossHourlyCents: budget.grossHourlyBudgetCents,
        feeBps: budget.feeBps,
      },
      select: { id: true },
    });

    const existingThread = await tx.thread.findFirst({
      where: { requestId: params.requestId, sellerUserId: params.sellerUserId },
      select: { id: true },
    });

    const thread = existingThread
      ? await tx.thread.update({
          where: { id: existingThread.id },
          data: {
            kind: "JOB",
            jobId: job.id,
            lastMessageAt: new Date(),
            messages: { create: { systemKind: "JOB_STARTED", body: "Request accepted — job started." } },
          },
          select: { id: true },
        })
      : await tx.thread.create({
          data: {
            kind: "JOB",
            buyerUserId: request.buyerUserId,
            sellerUserId: params.sellerUserId,
            requestId: params.requestId,
            jobId: job.id,
            messages: { create: { systemKind: "JOB_STARTED", body: "Request accepted — job started." } },
          },
          select: { id: true },
        });

    await notify(tx, {
      userId: request.buyerUserId,
      kind: "JOB_STARTED",
      dedupeKey: `job_started:${job.id}`,
      actorUserId: params.sellerUserId,
      requestId: params.requestId,
      jobId: job.id,
      threadId: thread.id,
    });

    return { jobId: job.id, threadId: thread.id };
  });
}

export async function declineDirectRequest(params: { requestId: string; sellerUserId: string }): Promise<void> {
  const request = await loadForTransition(params.requestId);
  const decision = applyRequestEvent(request, "SELLER_DECLINE", { userId: params.sellerUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  await db.$transaction(async (tx) => {
    const updated = await tx.request.updateMany({
      where: { id: params.requestId, status: "PENDING_SELLER" },
      data: { status: "DECLINED", closedAt: new Date() },
    });
    if (updated.count === 0) throw conflict("This request already moved on.");

    const thread = await tx.thread.findFirst({
      where: { requestId: params.requestId, sellerUserId: params.sellerUserId },
      select: { id: true },
    });
    if (thread) {
      await tx.message.create({
        data: { threadId: thread.id, systemKind: "REQUEST_CLOSED", body: "Request declined." },
      });
    }

    await notify(tx, {
      userId: request.buyerUserId,
      kind: "REQUEST_DECLINED",
      dedupeKey: `declined:${params.requestId}`,
      actorUserId: params.sellerUserId,
      requestId: params.requestId,
      threadId: thread?.id ?? null,
    });
  });
}

export async function cancelRequest(params: { requestId: string; buyerUserId: string }): Promise<void> {
  const request = await loadForTransition(params.requestId);
  const decision = applyRequestEvent(request, "BUYER_CANCEL", { userId: params.buyerUserId }, new Date());
  if (!decision.ok) throw notAllowed(decision.message);

  await db.$transaction(async (tx) => {
    const updated = await tx.request.updateMany({
      where: { id: params.requestId, status: { in: ["OPEN", "PENDING_SELLER"] } },
      data: { status: "CANCELLED", closedAt: new Date() },
    });
    if (updated.count === 0) throw conflict("This request already moved on.");

    const responders = await tx.requestResponse.findMany({
      where: { requestId: params.requestId, status: "PENDING" },
      select: { id: true, sellerUserId: true },
    });

    await tx.requestResponse.updateMany({
      where: { requestId: params.requestId, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });

    const targets = request.targetSellerUserId ? [request.targetSellerUserId] : responders.map((r) => r.sellerUserId);

    await notify(
      tx,
      targets.map((userId) => ({
        userId,
        kind: "REQUEST_CANCELLED" as const,
        dedupeKey: `cancelled:${params.requestId}:${userId}`,
        actorUserId: params.buyerUserId,
        requestId: params.requestId,
      })),
    );
  });
}

/**
 * Writes down an expiry that has already happened.
 *
 * Expiry is derived at read time (see effectiveRequestStatus), so this is only
 * about materializing the row and telling people. Safe to call repeatedly: the
 * status guard makes it a no-op the second time.
 */
export async function materializeExpiry(requestId: string): Promise<boolean> {
  const row = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, expiresAt: true, buyerUserId: true, targetSellerUserId: true },
  });
  if (!row) return false;
  if (row.status !== "OPEN" && row.status !== "PENDING_SELLER") return false;
  if (row.expiresAt.getTime() > Date.now()) return false;

  return db.$transaction(async (tx) => {
    const updated = await tx.request.updateMany({
      where: { id: requestId, status: { in: ["OPEN", "PENDING_SELLER"] } },
      data: { status: "EXPIRED", closedAt: new Date() },
    });
    if (updated.count === 0) return false;

    await tx.requestResponse.updateMany({
      where: { requestId, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });

    await notify(tx, {
      userId: row.buyerUserId,
      kind: "REQUEST_EXPIRED",
      dedupeKey: `expired:${requestId}`,
      requestId,
    });

    return true;
  });
}
