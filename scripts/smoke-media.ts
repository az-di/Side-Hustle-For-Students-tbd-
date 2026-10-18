/**
 * End-to-end check of media serving against a RUNNING server:
 *
 *   npx tsx scripts/smoke-media.ts http://localhost:3000
 *
 * Uploads a 1×1 PNG for the seeded Maya through the real mutation, fetches it
 * over HTTP, checks the headers, tries a missing key and a path traversal,
 * deletes it, and confirms the URL is gone. Needs the seed data and the same
 * DATABASE_URL / MEDIA_DIR as the server.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { deletePortfolioItem, uploadPortfolioMedia } from "@/modules/media/mutations";
import { listPortfolio } from "@/modules/media/queries";

const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
);

async function main(): Promise<void> {
  const base = process.argv[2] ?? "http://localhost:3000";
  const maya = await db.user.findUniqueOrThrow({ where: { uwEmail: "maya@uw.edu" }, select: { id: true } });

  const { itemId } = await uploadPortfolioMedia({ sellerUserId: maya.id, bytes: PNG, caption: "smoke" });
  const item = (await listPortfolio(maya.id)).find((i) => i.id === itemId)!;

  const ok = await fetch(base + item.url);
  const body = new Uint8Array(await ok.arrayBuffer());
  console.log("GET", item.url, ok.status, ok.headers.get("content-type"), ok.headers.get("cache-control"), "bytes", body.length);
  if (ok.status !== 200 || ok.headers.get("content-type") !== "image/png" || body.length !== PNG.length) {
    throw new Error("serving route failed");
  }

  const missing = await fetch(base + "/media/doesnotexist.png");
  const traversal = await fetch(base + "/media/..%2F..%2F.env");
  console.log("missing", missing.status, "traversal", traversal.status);
  if (missing.status !== 404 || traversal.status === 200) throw new Error("404 handling failed");

  await deletePortfolioItem({ sellerUserId: maya.id, itemId });
  const gone = await fetch(base + item.url);
  console.log("after delete", gone.status);
  if (gone.status !== 404) throw new Error("delete did not remove the file");
  console.log("SMOKE OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
