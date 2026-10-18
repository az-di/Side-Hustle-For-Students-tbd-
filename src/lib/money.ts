/**
 * The ONLY place in HUSTL where money arithmetic happens.
 *
 * Two kinds of amount exist, and conflating them is the bug this file is built
 * to prevent:
 *
 *   GROSS — authored by a BUYER. The ceiling they are willing to spend.
 *           Must never reach a seller-facing surface: not a page, not an API
 *           response, not an email, not a notification payload, not a system
 *           message in a thread (threads are read by both parties).
 *
 *   NET   — what the SELLER takes home, and what the buyer actually hands over
 *           in v1. Safe to show anyone.
 *
 * Seller-authored prices (listing price, hourly rate) are stored NET, because a
 * seller typing "$100" into their own listing must see "$100" back. Buyer-authored
 * budgets are stored GROSS. The two converters below are inverses of each other.
 */

/** Platform fee in basis points — hundredths of a percent. 1000 = 10%. */
export const DEFAULT_FEE_BPS = 1000;

const BPS_DIVISOR = 10_000;

function assertCents(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${label} must not be negative, got ${value}`);
  }
}

function assertFeeBps(feeBps: number): void {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= BPS_DIVISOR) {
    throw new Error(`feeBps must be an integer in [0, ${BPS_DIVISOR}), got ${feeBps}`);
  }
}

/**
 * Buyer's ceiling -> seller's payout. Floors, so we never promise a seller a
 * cent that does not exist.
 */
export function netFromGross(grossCents: number, feeBps: number = DEFAULT_FEE_BPS): number {
  assertCents(grossCents, "grossCents");
  assertFeeBps(feeBps);
  return Math.floor((grossCents * (BPS_DIVISOR - feeBps)) / BPS_DIVISOR);
}

/**
 * Seller's asking price -> what a buyer must budget to pay it. Ceils, so the
 * round trip through netFromGross returns exactly the seller's number.
 */
export function grossFromNet(netCents: number, feeBps: number = DEFAULT_FEE_BPS): number {
  assertCents(netCents, "netCents");
  assertFeeBps(feeBps);
  return Math.ceil((netCents * BPS_DIVISOR) / (BPS_DIVISOR - feeBps));
}

/** The platform's share of a gross amount. Zero while the beta fee is waived. */
export function feeFromGross(grossCents: number, feeBps: number = DEFAULT_FEE_BPS): number {
  return grossCents - netFromGross(grossCents, feeBps);
}

/** Nullable passthrough, so DTO mappers stay one-liners. */
export function netFromGrossOrNull(
  grossCents: number | null | undefined,
  feeBps: number = DEFAULT_FEE_BPS,
): number | null {
  return grossCents === null || grossCents === undefined ? null : netFromGross(grossCents, feeBps);
}

export function grossFromNetOrNull(
  netCents: number | null | undefined,
  feeBps: number = DEFAULT_FEE_BPS,
): number | null {
  return netCents === null || netCents === undefined ? null : grossFromNet(netCents, feeBps);
}

/** "$90", "$90.50" — no trailing ".00", because prices read better without it. */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

/**
 * A packaged job that takes about an hour of work should land near the hourly
 * rate. 1.5× lets a little editing ride along; 2× is "this is not an hour of
 * work, it is two." Used when a seller sets a flat price and an hourly rate
 * on the same profile or listing.
 */
export const FLAT_VS_HOURLY_MAX_RATIO = 1.5;

export function flatFitsHourly(fixedCents: number, hourlyCents: number): boolean {
  if (hourlyCents <= 0) return true;
  return fixedCents <= Math.round(hourlyCents * FLAT_VS_HOURLY_MAX_RATIO);
}

/** Parses "$1,200.50" / "1200.5" / "" into cents. Returns null for blank input. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Not a valid amount: ${input}`);
  }
  return Math.round(parsed * 100);
}

/** The fee percentage, for copy like "HUSTL's 10% fee is waived in beta". */
export function feePercentLabel(feeBps: number = DEFAULT_FEE_BPS): string {
  const percent = feeBps / 100;
  return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
}
