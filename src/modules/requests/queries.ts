import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import {
  toBuyerRequest,
  toResponseDto,
  toSellerRequest,
  type BuyerRequestDto,
  type ResponseDto,
  type SellerRequestDto,
} from "./dto";
import { effectiveRequestStatus } from "./state";

/** Everything the DTO mappers need, and nothing more. */
const REQUEST_SELECT = {
  id: true,
  kind: true,
  status: true,
  title: true,
  details: true,
  grossFixedBudgetCents: true,
  grossHourlyBudgetCents: true,
  feeBps: true,
  expiresAt: true,
  createdAt: true,
  buyerUserId: true,
  targetSellerUserId: true,
  chosenResponseId: true,
  buyer: { select: { handle: true, displayName: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true, kind: true } } } },
} as const;

const RESPONSE_SELECT = {
  id: true,
  status: true,
  message: true,
  createdAt: true,
  sellerUserId: true,
  seller: {
    select: {
      handle: true,
      displayName: true,
      sellerProfile: { select: { ratingAvg: true, ratingCount: true, completedJobCount: true } },
    },
  },
  thread: { select: { id: true } },
} as const;

/**
 * The open-request feed for a seller.
 *
 * Three filters do the work the spec asks for:
 *   * only tags this seller holds
 *   * only requests that have not expired (derived, no sweep needed)
 *   * not their own requests, and nothing already matched
 *
 * Returns SELLER DTOs, so every figure is a payout.
 */
export async function listOpenRequestsForSeller(sellerUserId: string): Promise<SellerRequestDto[]> {
  const rows = await db.request.findMany({
    where: {
      kind: "OPEN",
      status: "OPEN",
      expiresAt: { gt: new Date() },
      buyerUserId: { not: sellerUserId },
      tags: { some: { tag: { sellerTags: { some: { sellerUserId } } } } },
    },
    select: { ...REQUEST_SELECT, responses: { where: { sellerUserId }, select: { id: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Requests this seller already answered stay visible but are marked, so they
  // do not look like they vanished.
  return rows.map((row) => toSellerRequest(row));
}

export async function listMyResponses(sellerUserId: string) {
  const rows = await db.requestResponse.findMany({
    where: { sellerUserId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      request: { select: REQUEST_SELECT },
      thread: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return rows.map((row) => ({
    responseId: row.id,
    status: row.status,
    threadId: row.thread?.id ?? null,
    request: toSellerRequest(row.request),
  }));
}

/** Direct requests sent to this seller and still awaiting their answer. */
export async function listIncomingDirectRequests(sellerUserId: string): Promise<SellerRequestDto[]> {
  const rows = await db.request.findMany({
    where: {
      kind: "DIRECT",
      targetSellerUserId: sellerUserId,
      status: "PENDING_SELLER",
      expiresAt: { gt: new Date() },
    },
    select: REQUEST_SELECT,
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map((row) => toSellerRequest(row));
}

export async function listBuyerRequests(buyerUserId: string): Promise<
  (BuyerRequestDto & { responseCount: number; jobId: string | null })[]
> {
  const rows = await db.request.findMany({
    where: { buyerUserId },
    select: {
      ...REQUEST_SELECT,
      job: { select: { id: true } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((row) => ({
    ...toBuyerRequest(row),
    responseCount: row._count.responses,
    jobId: row.job?.id ?? null,
  }));
}

export type RequestDetail =
  | {
      role: "BUYER";
      request: BuyerRequestDto;
      responses: ResponseDto[];
      jobId: string | null;
      canCancel: boolean;
    }
  | {
      role: "SELLER";
      request: SellerRequestDto;
      myResponse: ResponseDto | null;
      jobId: string | null;
      threadId: string | null;
      canRespond: boolean;
      canAcceptDirect: boolean;
    };

/**
 * One request, rendered for whoever is asking.
 *
 * The role is derived per request — a user is a buyer on their own requests and
 * a seller on everyone else's — which is why role is never stored on the
 * session. Each branch returns a different DTO, so the buyer's ceiling cannot
 * reach a seller view even by accident.
 */
export async function getRequestForViewer(requestId: string, viewerId: string): Promise<RequestDetail> {
  const row = await db.request.findUnique({
    where: { id: requestId },
    select: {
      ...REQUEST_SELECT,
      responses: { select: RESPONSE_SELECT, orderBy: { createdAt: "asc" } },
      job: { select: { id: true, sellerUserId: true } },
      threads: { select: { id: true, sellerUserId: true } },
    },
  });
  if (!row) throw notFound("That request");

  const now = new Date();
  const effective = effectiveRequestStatus(row, now);

  if (row.buyerUserId === viewerId) {
    return {
      role: "BUYER",
      request: toBuyerRequest(row, now),
      responses: row.responses.map(toResponseDto),
      jobId: row.job?.id ?? null,
      canCancel: effective === "OPEN" || effective === "PENDING_SELLER",
    };
  }

  const mine = row.responses.find((r) => r.sellerUserId === viewerId) ?? null;
  const profile = await db.sellerProfile.findUnique({
    where: { userId: viewerId },
    select: { isAvailable: true },
  });

  const isTarget = row.targetSellerUserId === viewerId;
  const isJobHolder = row.job?.sellerUserId === viewerId;

  // A seller may only see an open request in one of their tags, a direct
  // request aimed at them, or a request they are already involved in.
  if (!isTarget && !mine && !isJobHolder) {
    const inMyTags = await db.requestTag.findFirst({
      where: { requestId, tag: { sellerTags: { some: { sellerUserId: viewerId } } } },
      select: { tagId: true },
    });
    if (!inMyTags || row.kind !== "OPEN") throw notFound("That request");
  }

  return {
    role: "SELLER",
    request: toSellerRequest(row, now),
    myResponse: mine ? toResponseDto(mine) : null,
    jobId: isJobHolder ? (row.job?.id ?? null) : null,
    threadId: row.threads.find((t) => t.sellerUserId === viewerId)?.id ?? null,
    canRespond: row.kind === "OPEN" && effective === "OPEN" && !mine && (profile?.isAvailable ?? false),
    canAcceptDirect: isTarget && effective === "PENDING_SELLER",
  };
}
