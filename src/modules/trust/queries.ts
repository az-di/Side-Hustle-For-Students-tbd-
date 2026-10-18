import { db } from "@/lib/db";

/**
 * Trust reads. Nothing here exposes a report's existence to its subject:
 * `relationshipWith` tells the viewer about THEIR OWN block and reports only.
 */

export type Relationship = {
  /** The viewer blocked them. */
  blockedByMe: boolean;
  /** Either direction — the UI hides contact affordances when true. */
  blocked: boolean;
  /** The viewer already has a general (non-job) report on file about them. */
  reportedByMe: boolean;
  /** Whether a report is even accepted (they share a thread). */
  canReport: boolean;
};

export async function relationshipWith(viewerId: string, otherUserId: string): Promise<Relationship> {
  if (viewerId === otherUserId) {
    return { blockedByMe: false, blocked: false, reportedByMe: false, canReport: false };
  }

  const [blocks, report, thread] = await Promise.all([
    db.block.findMany({
      where: {
        OR: [
          { blockerUserId: viewerId, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: viewerId },
        ],
      },
      select: { blockerUserId: true },
    }),
    db.report.findUnique({
      where: {
        reporterUserId_subjectUserId_scopeKey: {
          reporterUserId: viewerId,
          subjectUserId: otherUserId,
          scopeKey: "general",
        },
      },
      select: { id: true },
    }),
    db.thread.findFirst({
      where: {
        OR: [
          { buyerUserId: viewerId, sellerUserId: otherUserId },
          { buyerUserId: otherUserId, sellerUserId: viewerId },
        ],
      },
      select: { id: true },
    }),
  ]);

  return {
    blockedByMe: blocks.some((b) => b.blockerUserId === viewerId),
    blocked: blocks.length > 0,
    reportedByMe: report !== null,
    canReport: thread !== null,
  };
}

export async function listBlockedUsers(blockerUserId: string) {
  const rows = await db.block.findMany({
    where: { blockerUserId },
    select: { createdAt: true, blocked: { select: { id: true, handle: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt }));
}

export async function listMyReports(reporterUserId: string) {
  return db.report.findMany({
    where: { reporterUserId },
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      subject: { select: { handle: true, displayName: true } },
      job: { select: { id: true, request: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** The admin queue: open reports first, then the recently resolved. */
export async function listReportsForAdmin() {
  return db.report.findMany({
    select: {
      id: true,
      kind: true,
      reason: true,
      status: true,
      weight: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { id: true, handle: true, displayName: true } },
      subject: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          status: true,
          trust: { select: { negativeReportCount: true, autoSuspendedAt: true } },
        },
      },
      job: { select: { id: true, request: { select: { title: true } } } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}
