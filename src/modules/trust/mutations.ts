import type { ReportKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, invalid, notAllowed, notFound } from "@/lib/errors";
import type { Tx } from "@/lib/tx";
import { isBlocked } from "./block-filter";
import { REPORT_WEIGHTS, canAct, evaluateTrust, negativeWeight } from "./state";
import { SETTING_KEYS, getNumberSetting } from "./settings";

const MAX_REASON_LENGTH = 2_000;

/**
 * Guard for point actions. Call it next to the state-machine decision in any
 * mutation that connects two people.
 */
export async function assertCanReach(actorUserId: string, otherUserId: string, tx: Tx = db): Promise<void> {
  const actor = await tx.user.findUnique({ where: { id: actorUserId }, select: { status: true } });
  if (!actor) throw notFound("Your account");
  if (!canAct(actor.status)) {
    throw notAllowed("Your account is suspended, so you cannot do that right now.");
  }
  if (await isBlocked(actorUserId, otherUserId, tx)) {
    // Deliberately the same wording in both directions: a blocked person
    // must not be able to tell which way the block runs.
    throw notAllowed("You cannot contact this person.");
  }
}

// ──────────────────────────────── blocking ────────────────────────────────

export async function blockUser(params: { blockerUserId: string; blockedUserId: string }): Promise<void> {
  if (params.blockerUserId === params.blockedUserId) throw invalid("You cannot block yourself.");

  const target = await db.user.findUnique({ where: { id: params.blockedUserId }, select: { id: true } });
  if (!target) throw notFound("That person");

  await db.block.upsert({
    where: { blockerUserId_blockedUserId: params },
    create: params,
    update: {},
  });
}

export async function unblockUser(params: { blockerUserId: string; blockedUserId: string }): Promise<void> {
  await db.block.deleteMany({ where: params });
}

// ──────────────────────────────── reporting ───────────────────────────────

/**
 * Reports are only accepted from someone who has actually dealt with the
 * subject — a shared thread, which every request and job creates. This is the
 * anti-brigading rule: strangers cannot pile reports onto a profile.
 */
async function haveInteracted(a: string, b: string): Promise<boolean> {
  const thread = await db.thread.findFirst({
    where: {
      OR: [
        { buyerUserId: a, sellerUserId: b },
        { buyerUserId: b, sellerUserId: a },
      ],
    },
    select: { id: true },
  });
  return thread !== null;
}

export async function reportUser(params: {
  reporterUserId: string;
  subjectUserId: string;
  kind: ReportKind;
  reason: string;
  jobId?: string | null;
}): Promise<{ reportId: string }> {
  const reason = params.reason.trim();
  if (params.reporterUserId === params.subjectUserId) throw invalid("You cannot report yourself.");
  if (reason.length < 10) throw invalid("Say a little more about what happened.");
  if (reason.length > MAX_REASON_LENGTH) throw invalid("That is too long.");

  const subject = await db.user.findUnique({ where: { id: params.subjectUserId }, select: { id: true } });
  if (!subject) throw notFound("That person");

  if (params.jobId) {
    const job = await db.job.findUnique({
      where: { id: params.jobId },
      select: { buyerUserId: true, sellerUserId: true },
    });
    const parties = job ? [job.buyerUserId, job.sellerUserId] : [];
    if (!job || !parties.includes(params.reporterUserId) || !parties.includes(params.subjectUserId)) {
      throw notAllowed("You can only report someone about a job you were both on.");
    }
  } else if (!(await haveInteracted(params.reporterUserId, params.subjectUserId))) {
    throw notAllowed("You can report someone once you have a request or job with them.");
  }

  const scopeKey = params.jobId ?? "general";
  const existing = await db.report.findUnique({
    where: {
      reporterUserId_subjectUserId_scopeKey: {
        reporterUserId: params.reporterUserId,
        subjectUserId: params.subjectUserId,
        scopeKey,
      },
    },
    select: { id: true },
  });
  if (existing) throw conflict("You have already reported this — it is in the queue.");

  return db.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        reporterUserId: params.reporterUserId,
        subjectUserId: params.subjectUserId,
        kind: params.kind,
        reason,
        jobId: params.jobId ?? null,
        scopeKey,
        weight: REPORT_WEIGHTS[params.kind],
      },
      select: { id: true },
    });

    await recomputeTrust(tx, params.subjectUserId);
    return { reportId: report.id };
  });
}

/**
 * Recomputes a user's standing from their reports and applies the decision.
 * Called after every report write, including admin resolutions, so the stored
 * number and the account status can never disagree with the rows.
 */
export async function recomputeTrust(tx: Tx, userId: string): Promise<void> {
  const [user, reports, threshold] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { status: true, trust: { select: { autoSuspendedAt: true } } } }),
    tx.report.findMany({ where: { subjectUserId: userId }, select: { status: true, weight: true } }),
    getNumberSetting(SETTING_KEYS.reportSuspendThreshold, tx),
  ]);
  if (!user) return;

  const weight = negativeWeight(reports);
  const decision = evaluateTrust({
    status: user.status,
    weight,
    threshold,
    autoSuspended: user.trust?.autoSuspendedAt !== null && user.trust?.autoSuspendedAt !== undefined,
  });

  const now = new Date();
  await tx.userTrust.upsert({
    where: { userId },
    create: {
      userId,
      negativeReportCount: weight,
      autoSuspendedAt: decision.action === "SUSPEND" ? now : null,
    },
    update: {
      negativeReportCount: weight,
      ...(decision.action === "SUSPEND" ? { autoSuspendedAt: now } : {}),
      ...(decision.action === "REINSTATE" ? { autoSuspendedAt: null } : {}),
    },
  });

  if (decision.action === "SUSPEND") {
    await tx.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  } else if (decision.action === "REINSTATE") {
    await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  }
}

// Admin actions on reports and accounts live in modules/admin/mutations.ts,
// behind withAudit, so every one of them is logged.
