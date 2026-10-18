import type { JobStatus } from "@/generated/prisma/enums";

/**
 * The job lifecycle: the spec's "both mark complete", plus the auto-complete
 * that stops an unresponsive counterparty from freezing a job forever.
 *
 *   IN_PROGRESS --MARK_COMPLETE(either)--> AWAITING_CONFIRMATION
 *   AWAITING_CONFIRMATION --CONFIRM_COMPLETE(the OTHER party)--> COMPLETED
 *   AWAITING_CONFIRMATION --REJECT_COMPLETION(the OTHER party)--> IN_PROGRESS
 *   AWAITING_CONFIRMATION --AUTO_COMPLETE(system, after the window)--> COMPLETED
 *
 * Two deliberate asymmetries:
 *
 *  * Only the *other* party may confirm. Otherwise whoever marked complete
 *    could immediately confirm their own mark and mint a completed job.
 *  * MARK_COMPLETE requires that both people have actually spoken in the
 *    thread. Without that, anyone could fire MARK_COMPLETE at a dead job, wait
 *    out the auto-complete window, and manufacture a completed-job count and a
 *    review slot out of nothing.
 */

export type JobEvent = "MARK_COMPLETE" | "CONFIRM_COMPLETE" | "REJECT_COMPLETION" | "AUTO_COMPLETE" | "CANCEL";

type JobActorRule = "EITHER_PARTY" | "OTHER_PARTY" | "SYSTEM";

type JobTransition = { to: JobStatus; actor: JobActorRule; guard?: "DIALOGUE" | "AUTO_DUE" };

export const JOB_TRANSITIONS: Partial<Record<JobStatus, Partial<Record<JobEvent, JobTransition>>>> = {
  IN_PROGRESS: {
    MARK_COMPLETE: { to: "AWAITING_CONFIRMATION", actor: "EITHER_PARTY", guard: "DIALOGUE" },
    CANCEL: { to: "CANCELLED", actor: "EITHER_PARTY" },
  },
  AWAITING_CONFIRMATION: {
    CONFIRM_COMPLETE: { to: "COMPLETED", actor: "OTHER_PARTY" },
    REJECT_COMPLETION: { to: "IN_PROGRESS", actor: "OTHER_PARTY" },
    AUTO_COMPLETE: { to: "COMPLETED", actor: "SYSTEM", guard: "AUTO_DUE" },
    CANCEL: { to: "CANCELLED", actor: "EITHER_PARTY" },
  },
  // COMPLETED and CANCELLED are terminal.
};

export const TERMINAL_JOB_STATUSES: JobStatus[] = ["COMPLETED", "CANCELLED"];

export type JobDenialReason =
  | "TERMINAL"
  | "NOT_ALLOWED_FOR_STATUS"
  | "NOT_A_PARTY"
  | "MUST_BE_OTHER_PARTY"
  | "NO_DIALOGUE_YET"
  | "AUTO_NOT_DUE";

export type JobDecision =
  | { ok: true; to: JobStatus }
  | { ok: false; reason: JobDenialReason; message: string };

const DENIAL_MESSAGES: Record<JobDenialReason, string> = {
  TERMINAL: "This job is already finished.",
  NOT_ALLOWED_FOR_STATUS: "That is not possible for this job right now.",
  NOT_A_PARTY: "Only the buyer and the seller on this job can do that.",
  MUST_BE_OTHER_PARTY: "You marked this complete — the other person needs to confirm it.",
  NO_DIALOGUE_YET: "Send a message first so you both agree the work is done.",
  AUTO_NOT_DUE: "The confirmation window has not passed yet.",
};

function deny(reason: JobDenialReason): JobDecision {
  return { ok: false, reason, message: DENIAL_MESSAGES[reason] };
}

export type JobStateView = {
  status: JobStatus;
  buyerUserId: string;
  sellerUserId: string;
  completionRequestedById: string | null;
  autoCompleteAt: Date | null;
};

export type JobActorView = {
  userId: string;
  isSystem?: boolean;
  /** Both parties have posted at least one message in the job thread. */
  threadHasDialogue?: boolean;
};

export function applyJobEvent(
  job: JobStateView,
  event: JobEvent,
  actor: JobActorView,
  now: Date,
): JobDecision {
  if (TERMINAL_JOB_STATUSES.includes(job.status)) return deny("TERMINAL");

  const transition = JOB_TRANSITIONS[job.status]?.[event];
  if (!transition) return deny("NOT_ALLOWED_FOR_STATUS");

  const isParty = actor.userId === job.buyerUserId || actor.userId === job.sellerUserId;

  switch (transition.actor) {
    case "SYSTEM":
      if (!actor.isSystem) return deny("NOT_A_PARTY");
      break;
    case "EITHER_PARTY":
      if (!isParty) return deny("NOT_A_PARTY");
      break;
    case "OTHER_PARTY":
      if (!isParty) return deny("NOT_A_PARTY");
      if (actor.userId === job.completionRequestedById) return deny("MUST_BE_OTHER_PARTY");
      break;
  }

  if (transition.guard === "DIALOGUE" && !actor.threadHasDialogue) return deny("NO_DIALOGUE_YET");
  if (transition.guard === "AUTO_DUE" && !isAutoCompleteDue(job, now)) return deny("AUTO_NOT_DUE");

  return { ok: true, to: transition.to };
}

export function isAutoCompleteDue(
  job: { status: JobStatus; autoCompleteAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    job.status === "AWAITING_CONFIRMATION" &&
    job.autoCompleteAt !== null &&
    job.autoCompleteAt.getTime() <= now.getTime()
  );
}

/**
 * Auto-completion is DERIVED, like request expiry: a job past its window reads
 * as COMPLETED straight away, and `materializeAutoComplete` writes it down the
 * next time anyone opens the job. No cron required for correctness.
 */
export function effectiveJobStatus(
  job: { status: JobStatus; autoCompleteAt: Date | null },
  now: Date = new Date(),
): JobStatus {
  return isAutoCompleteDue(job, now) ? "COMPLETED" : job.status;
}

/** Reviews unlock on completion, including auto-completion. */
export function isReviewable(job: { status: JobStatus; autoCompleteAt: Date | null }, now: Date = new Date()): boolean {
  return effectiveJobStatus(job, now) === "COMPLETED";
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  IN_PROGRESS: "In progress",
  AWAITING_CONFIRMATION: "Waiting on confirmation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
