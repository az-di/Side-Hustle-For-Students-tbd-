import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOpenRequest } from "@/modules/requests/mutations";
import { cleanup, makeTag, makeUser } from "@/test/factories";
import { addSellerTags } from "./mutations";
import { listCourseTagsBySubject, searchTags } from "./queries";

let seller: { id: string };
let buyer: { id: string };

beforeAll(async () => {
  seller = await makeUser({ seller: true });
  buyer = await makeUser();
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("course catalog", () => {
  it("groups seeded courses by subject with numbers in order", async () => {
    const groups = await listCourseTagsBySubject();
    const math = groups.find((g) => g.subject === "MATH");
    expect(math).toBeDefined();
    expect(math!.tags.map((t) => t.name).slice(0, 3)).toEqual(["MATH 120", "MATH 124", "MATH 125"]);
    expect(groups.find((g) => g.subject === "CSE")!.tags.length).toBeGreaterThan(10);
  });

  it("finds courses by code, compact code and nickname", async () => {
    expect((await searchTags("math124")).map((t) => t.name)).toContain("MATH 124");
    expect((await searchTags("orgo")).map((t) => t.name)).toContain("CHEM 237");
    expect((await searchTags("diff eq")).map((t) => t.name)).toContain("MATH 207");
  });

  it("bulk-adds only the tags the seller lacks and alerts watchers once", async () => {
    const a = await makeTag();
    const b = await makeTag();
    await createOpenRequest({
      buyerUserId: buyer.id,
      title: "Catalog fixture",
      details: "Integration test fixture, safe to delete.",
      tagIds: [a.id, b.id],
      grossFixedBudgetCents: 1_000,
      grossHourlyBudgetCents: null,
    });

    expect(await addSellerTags({ userId: seller.id, tagIds: [a.id] })).toEqual({ added: 1 });
    expect(await addSellerTags({ userId: seller.id, tagIds: [a.id, b.id, b.id] })).toEqual({ added: 1 });
    expect(await addSellerTags({ userId: seller.id, tagIds: [a.id, b.id] })).toEqual({ added: 0 });

    const alerts = await db.notification.findMany({ where: { userId: buyer.id, kind: "SELLER_OPEN_TO_TAG", actorUserId: seller.id } });
    expect(alerts.map((n) => n.tagId).sort()).toEqual([a.id, b.id].sort());
  });
});
