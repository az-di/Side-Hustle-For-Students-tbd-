import { db } from "@/lib/db";
import { synonymsOf } from "./mutations";

export async function listTagsForAdmin() {
  const rows = await db.tag.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      isActive: true,
      sortOrder: true,
      searchTerms: true,
      _count: { select: { sellerTags: true, requestTags: true } },
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    kind: t.kind,
    isActive: t.isActive,
    sortOrder: t.sortOrder,
    synonyms: synonymsOf(t),
    sellerCount: t._count.sellerTags,
    requestCount: t._count.requestTags,
  }));
}

export async function listUsersForAdmin(params: { q?: string; limit?: number } = {}) {
  const q = params.q?.trim();
  return db.user.findMany({
    where: q
      ? { OR: [{ handle: { contains: q, mode: "insensitive" } }, { uwEmail: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }] }
      : undefined,
    select: {
      id: true,
      handle: true,
      displayName: true,
      uwEmail: true,
      status: true,
      isAdmin: true,
      isDemo: true,
      createdAt: true,
      sellerProfile: { select: { isAvailable: true, completedJobCount: true, ratingAvg: true } },
      trust: { select: { negativeReportCount: true, autoSuspendedAt: true } },
      _count: { select: { reportsAgainst: true, buyerRequests: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}

export async function listAuditLog(limit = 200) {
  return db.adminAuditLog.findMany({
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      payload: true,
      createdAt: true,
      admin: { select: { handle: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function adminOverview() {
  const [users, openReports, tags, pendingEmails] = await Promise.all([
    db.user.count(),
    db.report.count({ where: { status: "OPEN" } }),
    db.tag.count({ where: { isActive: true } }),
    db.outboundEmail.count({ where: { status: "PENDING" } }),
  ]);
  return { users, openReports, tags, pendingEmails };
}
