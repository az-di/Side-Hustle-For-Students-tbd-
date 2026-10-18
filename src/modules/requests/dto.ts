import type { RequestKind, RequestStatus, ResponseStatus } from "@/generated/prisma/enums";
import { netFromGrossOrNull } from "@/lib/money";
import { effectiveRequestStatus } from "./state";

/**
 * THE money boundary.
 *
 * Two mappers over the same row, one per audience. The seller-facing shape has
 * no field that could hold a gross figure, so a leak is not a mistake you can
 * make by forgetting a check — there is nowhere to put the number.
 *
 * House rules for this file, which are the whole reason it exists:
 *
 *   1. NO object spread. `...row` is precisely how grossFixedBudgetCents
 *      escapes into a seller payload. Every field is written out by hand.
 *   2. Seller mappers may call netFromGross* and nothing else money-related.
 *   3. Anything added to RequestRow must be added to the DTOs deliberately.
 *
 * src/modules/requests/dto.test.ts asserts the gross value never appears in a
 * serialized seller DTO.
 */

export type RequestRow = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  title: string;
  details: string;
  grossFixedBudgetCents: number | null;
  grossHourlyBudgetCents: number | null;
  feeBps: number;
  expiresAt: Date;
  createdAt: Date;
  buyerUserId: string;
  targetSellerUserId: string | null;
  chosenResponseId: string | null;
  buyer: { handle: string; displayName: string };
  tags: { tag: { id: string; name: string; slug: string; kind: "SERVICE" | "COURSE" } }[];
};

export type TagChip = { id: string; name: string; slug: string; kind: "SERVICE" | "COURSE" };

function toTagChips(row: RequestRow): TagChip[] {
  return row.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug, kind: t.tag.kind }));
}

// ───────────────────────────── seller-facing ──────────────────────────────

/**
 * What a seller sees. `payout*` is the only money here, and it is what they
 * take home. The buyer's ceiling is not represented in this type at all.
 */
export type SellerRequestDto = {
  id: string;
  kind: RequestKind;
  effectiveStatus: RequestStatus;
  title: string;
  details: string;
  payoutFixedCents: number | null;
  payoutHourlyCents: number | null;
  expiresAt: string;
  createdAt: string;
  buyer: { handle: string; displayName: string };
  tags: TagChip[];
  isMatched: boolean;
};

export function toSellerRequest(row: RequestRow, now: Date = new Date()): SellerRequestDto {
  return {
    id: row.id,
    kind: row.kind,
    effectiveStatus: effectiveRequestStatus(row, now),
    title: row.title,
    details: row.details,
    payoutFixedCents: netFromGrossOrNull(row.grossFixedBudgetCents, row.feeBps),
    payoutHourlyCents: netFromGrossOrNull(row.grossHourlyBudgetCents, row.feeBps),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    buyer: { handle: row.buyer.handle, displayName: row.buyer.displayName },
    tags: toTagChips(row),
    isMatched: row.chosenResponseId !== null || row.status === "MATCHED",
  };
}

// ────────────────────────────── buyer-facing ──────────────────────────────

/**
 * What the buyer sees: their own ceiling AND the figure the seller was shown,
 * because in v1 the net figure is what they actually hand over.
 */
export type BuyerRequestDto = {
  id: string;
  kind: RequestKind;
  effectiveStatus: RequestStatus;
  title: string;
  details: string;
  budgetFixedCents: number | null;
  budgetHourlyCents: number | null;
  sellerSeesFixedCents: number | null;
  sellerSeesHourlyCents: number | null;
  feeBps: number;
  expiresAt: string;
  createdAt: string;
  tags: TagChip[];
  targetSellerUserId: string | null;
};

export function toBuyerRequest(row: RequestRow, now: Date = new Date()): BuyerRequestDto {
  return {
    id: row.id,
    kind: row.kind,
    effectiveStatus: effectiveRequestStatus(row, now),
    title: row.title,
    details: row.details,
    budgetFixedCents: row.grossFixedBudgetCents,
    budgetHourlyCents: row.grossHourlyBudgetCents,
    sellerSeesFixedCents: netFromGrossOrNull(row.grossFixedBudgetCents, row.feeBps),
    sellerSeesHourlyCents: netFromGrossOrNull(row.grossHourlyBudgetCents, row.feeBps),
    feeBps: row.feeBps,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    tags: toTagChips(row),
    targetSellerUserId: row.targetSellerUserId,
  };
}

// ───────────────────────────────── responses ───────────────────────────────

export type ResponseDto = {
  id: string;
  status: ResponseStatus;
  message: string;
  createdAt: string;
  seller: {
    userId: string;
    handle: string;
    displayName: string;
    ratingAvg: number | null;
    ratingCount: number;
    completedJobCount: number;
  };
  threadId: string | null;
};

export function toResponseDto(row: {
  id: string;
  status: ResponseStatus;
  message: string;
  createdAt: Date;
  sellerUserId: string;
  seller: {
    handle: string;
    displayName: string;
    sellerProfile: { ratingAvg: number | null; ratingCount: number; completedJobCount: number } | null;
  };
  thread: { id: string } | null;
}): ResponseDto {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    seller: {
      userId: row.sellerUserId,
      handle: row.seller.handle,
      displayName: row.seller.displayName,
      ratingAvg: row.seller.sellerProfile?.ratingAvg ?? null,
      ratingCount: row.seller.sellerProfile?.ratingCount ?? 0,
      completedJobCount: row.seller.sellerProfile?.completedJobCount ?? 0,
    },
    threadId: row.thread?.id ?? null,
  };
}
