import type { ReportKind, ReportStatus, UserStatus } from "@/generated/prisma/enums";

/**
 * Trust rules, pure. No I/O, no clock — the same shape as the request and job
 * state machines, so every rule here is unit-tested in milliseconds.
 */

/**
 * How much each kind of report counts towards suspension. Frozen onto the
 * Report row at creation, so re-weighting a kind never restates old reports.
 */
export const REPORT_WEIGHTS: Record<ReportKind, number> = {
  SCAM: 3,
  ABUSIVE: 2,
  ACADEMIC_DISHONESTY: 2,
  NO_SHOW: 1,
  OFF_PLATFORM_PRESSURE: 1,
  SPAM: 1,
  OTHER: 1,
};

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  NO_SHOW: "Did not show up or deliver",
  ABUSIVE: "Abusive or harassing",
  SCAM: "Scam or payment fraud",
  ACADEMIC_DISHONESTY: "Asked for graded work to be done for them",
  OFF_PLATFORM_PRESSURE: "Pressured to go off-platform",
  SPAM: "Spam",
  OTHER: "Something else",
};

/** Only reports that have not been thrown out count. */
export function reportCounts(status: ReportStatus): boolean {
  return status === "OPEN" || status === "UPHELD";
}

/** Sum of the weights of the reports that still count. */
export function negativeWeight(reports: { status: ReportStatus; weight: number }[]): number {
  return reports.reduce((sum, r) => (reportCounts(r.status) ? sum + r.weight : sum), 0);
}

export type TrustDecision =
  | { action: "NONE" }
  | { action: "SUSPEND"; reason: string }
  | { action: "REINSTATE" };

/**
 * What should happen to an account given its current standing.
 *
 *   * an ACTIVE account at or over the threshold is suspended
 *   * an auto-suspended account that drops back under it (reports dismissed)
 *     is reinstated — but one an admin suspended by hand stays put
 *   * CLOSED is terminal and never touched here
 */
export function evaluateTrust(input: {
  status: UserStatus;
  weight: number;
  threshold: number;
  autoSuspended: boolean;
}): TrustDecision {
  if (input.status === "CLOSED") return { action: "NONE" };

  if (input.status === "ACTIVE" && input.weight >= input.threshold) {
    return {
      action: "SUSPEND",
      reason: `Report weight ${input.weight} reached the threshold of ${input.threshold}.`,
    };
  }

  if (input.status === "SUSPENDED" && input.autoSuspended && input.weight < input.threshold) {
    return { action: "REINSTATE" };
  }

  return { action: "NONE" };
}

/** Can this account take an action that touches another person? */
export function canAct(status: UserStatus): boolean {
  return status === "ACTIVE";
}

/**
 * A block is symmetric for everything that matters: if either of two people
 * has blocked the other, neither can reach the other.
 */
export function isBlockedPair(
  blocks: { blockerUserId: string; blockedUserId: string }[],
  a: string,
  b: string,
): boolean {
  return blocks.some(
    (x) =>
      (x.blockerUserId === a && x.blockedUserId === b) || (x.blockerUserId === b && x.blockedUserId === a),
  );
}
