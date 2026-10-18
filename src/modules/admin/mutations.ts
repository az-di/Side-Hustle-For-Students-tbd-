import { conflict, invalid, notFound } from "@/lib/errors";
import { normalizeTerm } from "@/modules/catalog/queries";
import { recomputeTrust } from "@/modules/trust/mutations";
import { SETTING_KEYS } from "@/modules/trust/settings";
import { withAudit } from "./audit";

/**
 * Admin writes. Every function here goes through withAudit, which is the only
 * way to get a transaction — so every one of them is logged.
 */

// ──────────────────────────────────── tags ────────────────────────────────

const MAX_SYNONYMS = 40;

export function slugify(name: string): string {
  return normalizeTerm(name).replace(/\s+/g, "-");
}

/**
 * searchTerms = the normalized name plus the hidden synonyms, deduped. One
 * function builds it for create and update, so the two can never drift — and
 * it uses the same normalizer the typeahead applies to queries.
 */
export function buildSearchTerms(name: string, synonyms: string[]): string[] {
  const terms = [normalizeTerm(name), ...synonyms.map(normalizeTerm)].filter((t) => t.length > 0);
  return [...new Set(terms)];
}

/** The hidden synonyms, recovered from searchTerms for the editor. */
export function synonymsOf(tag: { name: string; searchTerms: string[] }): string[] {
  const own = normalizeTerm(tag.name);
  return tag.searchTerms.filter((t) => t !== own);
}

export type TagInput = {
  name: string;
  kind: "SERVICE" | "COURSE";
  synonyms: string[];
  sortOrder: number;
};

function assertTagInput(input: TagInput): void {
  if (normalizeTerm(input.name).length < 2) throw invalid("Give the tag a name.");
  if (input.synonyms.length > MAX_SYNONYMS) throw invalid(`At most ${MAX_SYNONYMS} synonyms.`);
  if (!Number.isInteger(input.sortOrder)) throw invalid("Sort order must be a whole number.");
}

export async function createTag(adminUserId: string, input: TagInput): Promise<{ tagId: string }> {
  assertTagInput(input);
  const slug = slugify(input.name);

  return withAudit(
    adminUserId,
    { action: "tag.create", targetType: "tag", targetId: slug, payload: { ...input, slug } },
    async (tx) => {
      const existing = await tx.tag.findUnique({ where: { slug }, select: { id: true } });
      if (existing) throw conflict("A tag with that name already exists.");

      const tag = await tx.tag.create({
        data: {
          slug,
          name: input.name.trim(),
          kind: input.kind,
          sortOrder: input.sortOrder,
          searchTerms: buildSearchTerms(input.name, input.synonyms),
        },
        select: { id: true },
      });
      return { tagId: tag.id };
    },
  );
}

export async function updateTag(adminUserId: string, tagId: string, input: TagInput): Promise<void> {
  assertTagInput(input);

  await withAudit(
    adminUserId,
    { action: "tag.update", targetType: "tag", targetId: tagId, payload: input },
    async (tx) => {
      const tag = await tx.tag.findUnique({ where: { id: tagId }, select: { id: true } });
      if (!tag) throw notFound("That tag");

      // Slug is stable on rename: it is in URLs and seed data. Only the
      // display name and the search terms change.
      await tx.tag.update({
        where: { id: tagId },
        data: {
          name: input.name.trim(),
          kind: input.kind,
          sortOrder: input.sortOrder,
          searchTerms: buildSearchTerms(input.name, input.synonyms),
        },
      });
    },
  );
}

/** Inactive tags leave search and the browse grid; sellers and requests keep them. */
export async function setTagActive(adminUserId: string, tagId: string, isActive: boolean): Promise<void> {
  await withAudit(
    adminUserId,
    { action: "tag.active", targetType: "tag", targetId: tagId, payload: { isActive } },
    async (tx) => {
      await tx.tag.update({ where: { id: tagId }, data: { isActive } });
    },
  );
}

// ─────────────────────────────────── users ────────────────────────────────

export async function setUserAdmin(adminUserId: string, userId: string, isAdmin: boolean): Promise<void> {
  if (adminUserId === userId && !isAdmin) throw invalid("You cannot remove your own admin access.");

  await withAudit(
    adminUserId,
    { action: "user.admin", targetType: "user", targetId: userId, payload: { isAdmin } },
    async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isAdmin } });
    },
  );
}

/**
 * Admin override of an account's status. CLOSED signs the person out
 * everywhere. A hand-set status is never auto-reverted by the report
 * threshold (the auto marker is cleared).
 */
export async function setUserStatus(
  adminUserId: string,
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "CLOSED",
): Promise<void> {
  if (adminUserId === userId) throw invalid("You cannot change your own status.");

  await withAudit(
    adminUserId,
    { action: "user.status", targetType: "user", targetId: userId, payload: { status } },
    async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status } });
      await tx.userTrust.upsert({
        where: { userId },
        create: { userId, autoSuspendedAt: null },
        update: { autoSuspendedAt: null },
      });
      if (status === "CLOSED") await tx.session.deleteMany({ where: { userId } });
    },
  );
}

// ────────────────────────────────── reports ───────────────────────────────

export async function resolveReport(
  adminUserId: string,
  reportId: string,
  outcome: "UPHELD" | "DISMISSED",
): Promise<void> {
  await withAudit(
    adminUserId,
    { action: "report.resolve", targetType: "report", targetId: reportId, payload: { outcome } },
    async (tx) => {
      const report = await tx.report.findUnique({ where: { id: reportId }, select: { subjectUserId: true } });
      if (!report) throw notFound("That report");

      const updated = await tx.report.updateMany({
        where: { id: reportId, status: "OPEN" },
        data: { status: outcome, resolvedById: adminUserId, resolvedAt: new Date() },
      });
      if (updated.count === 0) throw conflict("That report was already resolved.");
      await recomputeTrust(tx, report.subjectUserId);
    },
  );
}

// ────────────────────────────────── settings ──────────────────────────────

export async function setReportThreshold(adminUserId: string, threshold: number): Promise<void> {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    throw invalid("The threshold is a whole number from 1 to 100.");
  }
  const key = SETTING_KEYS.reportSuspendThreshold;
  await withAudit(
    adminUserId,
    { action: "setting.update", targetType: "setting", targetId: key, payload: { value: threshold } },
    async (tx) => {
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: String(threshold) },
        update: { value: String(threshold) },
      });
    },
  );
}
