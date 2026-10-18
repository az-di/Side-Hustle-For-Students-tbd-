import { NextResponse } from "next/server";
import { searchTags } from "@/modules/catalog/queries";

/**
 * Tag typeahead for the search box and the request composer.
 *
 * Cacheable: tag data changes only when the team edits the seed, so a short
 * shared cache costs nothing and makes typing feel instant.
 *
 * The response intentionally omits which term matched — the synonym list is
 * hidden, and echoing matches back would make it enumerable.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ tags: [] });
  }

  const tags = await searchTags(q, 10);

  return NextResponse.json(
    { tags: tags.map((t) => ({ id: t.id, name: t.name, kind: t.kind, slug: t.slug })) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
