import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cleanup, makeUser } from "@/test/factories";
import { deletePortfolioItem, uploadPortfolioMedia } from "./mutations";
import { getAssetByKey, listPortfolio } from "./queries";
import { mediaExists } from "./storage";

/** Smallest valid PNG: 1×1 transparent pixel. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

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

describe("portfolio uploads", () => {
  let itemId: string;
  let storageKey: string;

  it("stores a sniffed file and lists it with a served URL", async () => {
    const { assetId, itemId: id } = await uploadPortfolioMedia({ sellerUserId: seller.id, bytes: PNG, caption: "  pixel " });
    itemId = id;

    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    storageKey = asset.storageKey;
    expect(asset.mimeType).toBe("image/png");
    expect(asset.kind).toBe("IMAGE");
    expect(asset.bytes).toBe(PNG.byteLength);
    expect(await mediaExists(storageKey)).toBe(true);

    const items = await listPortfolio(seller.id);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe(`/media/${storageKey}`);
    expect(items[0].caption).toBe("pixel");

    expect((await getAssetByKey(storageKey))?.mimeType).toBe("image/png");
  });

  it("refuses a file that is not a known media type, whatever it is called", async () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    await expect(uploadPortfolioMedia({ sellerUserId: seller.id, bytes: html })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("refuses uploads from someone without a seller profile", async () => {
    await expect(uploadPortfolioMedia({ sellerUserId: buyer.id, bytes: PNG })).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("only the owner can delete, and deleting removes the file", async () => {
    await expect(deletePortfolioItem({ sellerUserId: buyer.id, itemId })).rejects.toMatchObject({ code: "NOT_ALLOWED" });

    await deletePortfolioItem({ sellerUserId: seller.id, itemId });
    expect(await listPortfolio(seller.id)).toHaveLength(0);
    expect(await mediaExists(storageKey)).toBe(false);
    expect(await getAssetByKey(storageKey)).toBeNull();
  });
});
