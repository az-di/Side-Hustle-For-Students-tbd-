import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getAssetByKey } from "@/modules/media/queries";
import { STORAGE_KEY_SHAPE } from "@/modules/media/state";
import { mediaExists, openMedia } from "@/modules/media/storage";

/**
 * Serves an uploaded file. Public: portfolios are public. The content type
 * comes from the row (decided by sniffing at upload), never from the request
 * or the extension, and `nosniff` stops a browser second-guessing it. Keys are
 * random and immutable, so the response can be cached forever.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!STORAGE_KEY_SHAPE.test(key)) return new NextResponse(null, { status: 404 });

  const asset = await getAssetByKey(key);
  if (!asset || !(await mediaExists(key))) return new NextResponse(null, { status: 404 });

  const { stream, size } = openMedia(key);
  return new NextResponse(Readable.toWeb(stream as Readable) as ReadableStream, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(await size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
