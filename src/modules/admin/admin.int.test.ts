import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { normalizeTerm, searchTags } from "@/modules/catalog/queries";
import { cleanup, makeUser, uniq } from "@/test/factories";
import { createTag, setReportThreshold, setTagActive, setUserAdmin, setUserStatus, updateTag } from "./mutations";
import { listAuditLog } from "./queries";

let admin: { id: string };
let civilian: { id: string };
let createdTagId: string;
const tagName = uniq("Zebra Grooming");

beforeAll(async () => {
  admin = await makeUser({ isAdmin: true });
  civilian = await makeUser();
});

afterAll(async () => {
  if (createdTagId) await db.tag.deleteMany({ where: { id: createdTagId } });
  await cleanup();
  await db.$disconnect();
});

describe("tags", () => {
  const name = tagName;

  it("creates a tag whose hidden synonyms are found by the typeahead", async () => {
    const synonym = uniq("stripey");
    ({ tagId: createdTagId } = await createTag(admin.id, { name, kind: "SERVICE", synonyms: [synonym], sortOrder: 999 }));

    const hits = await searchTags(synonym);
    expect(hits.map((h) => h.id)).toContain(createdTagId);
  });

  it("regenerates searchTerms on update, dropping removed synonyms", async () => {
    const replacement = uniq("mane");
    await updateTag(admin.id, createdTagId, { name, kind: "SERVICE", synonyms: [replacement], sortOrder: 999 });

    const tag = await db.tag.findUniqueOrThrow({ where: { id: createdTagId } });
    expect(tag.searchTerms).toContain(normalizeTerm(replacement));
    expect(tag.searchTerms.some((t) => t.startsWith("stripey"))).toBe(false);
    expect((await searchTags(replacement)).map((h) => h.id)).toContain(createdTagId);
  });

  it("deactivating removes it from search", async () => {
    await setTagActive(admin.id, createdTagId, false);
    expect((await searchTags(name)).map((h) => h.id)).not.toContain(createdTagId);
  });

  it("refuses a duplicate name", async () => {
    await expect(createTag(admin.id, { name, kind: "SERVICE", synonyms: [], sortOrder: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("users and settings", () => {
  it("promotes and demotes, but never lets an admin demote themselves", async () => {
    await setUserAdmin(admin.id, civilian.id, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: civilian.id } })).isAdmin).toBe(true);
    await setUserAdmin(admin.id, civilian.id, false);
    await expect(setUserAdmin(admin.id, admin.id, false)).rejects.toMatchObject({ code: "INVALID" });
  });

  it("closing an account deletes its sessions", async () => {
    await db.session.create({ data: { userId: civilian.id, tokenHash: uniq("hash"), expiresAt: new Date(Date.now() + 60_000) } });
    await setUserStatus(admin.id, civilian.id, "CLOSED");
    expect(await db.session.count({ where: { userId: civilian.id } })).toBe(0);
    await setUserStatus(admin.id, civilian.id, "ACTIVE");
  });

  it("stores the threshold as a setting and validates it", async () => {
    await setReportThreshold(admin.id, 4);
    expect((await db.platformSetting.findUniqueOrThrow({ where: { key: "report_suspend_threshold" } })).value).toBe("4");
    await expect(setReportThreshold(admin.id, 0)).rejects.toMatchObject({ code: "INVALID" });
    await setReportThreshold(admin.id, 3);
  });
});

describe("audit", () => {
  it("refuses every write from a non-admin", async () => {
    await expect(setTagActive(civilian.id, createdTagId, true)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    await expect(setReportThreshold(civilian.id, 3)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("logged every admin write above with who did it", async () => {
    const me = await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { handle: true } });
    const actions = (await listAuditLog(500)).filter((r) => r.admin.handle === me.handle).map((r) => r.action);
    for (const expected of ["tag.create", "tag.update", "tag.active", "user.admin", "user.status", "setting.update"]) {
      expect(actions).toContain(expected);
    }
  });

  it("does not log an action that rolled back", async () => {
    const before = await db.adminAuditLog.count({ where: { adminUserId: admin.id, action: "tag.create" } });
    // Same name as the tag created above: the create throws CONFLICT inside withAudit.
    await expect(createTag(admin.id, { name: tagName, kind: "SERVICE", synonyms: [], sortOrder: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const after = await db.adminAuditLog.count({ where: { adminUserId: admin.id, action: "tag.create" } });
    expect(after).toBe(before);
  });
});
