import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getTagBySlug, listCourseTagsBySubject, listSellersForTag, listServiceTags } from "@/modules/catalog/queries";
import { formatCents } from "@/lib/money";
import { TagSearchBox } from "@/components/tag-search-box";
import { Avatar, Badge, ButtonLink, CardLink, EmptyState, PageHeader, Price, Stars } from "@/components/ui";

export const metadata = { title: "Find someone · HUSTL" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; minRating?: string }>;
}) {
  const { tag: tagSlug, minRating } = await searchParams;
  const [tag, viewer] = await Promise.all([tagSlug ? getTagBySlug(tagSlug) : null, getViewer()]);
  const minRatingNum = minRating ? Number(minRating) : undefined;

  const sellers = tag
    ? await listSellersForTag({
        tagId: tag.id,
        minRating: Number.isFinite(minRatingNum) ? minRatingNum : undefined,
        viewerId: viewer?.id ?? null,
      })
    : [];
  const [serviceTags, courseGroups] = tag
    ? ([[], []] as [Awaited<ReturnType<typeof listServiceTags>>, Awaited<ReturnType<typeof listCourseTagsBySubject>>])
    : await Promise.all([listServiceTags(), listCourseTagsBySubject()]);

  return (
    <main>
      <PageHeader
        title={tag ? tag.name : "Find someone"}
        subtitle={
          tag
            ? `${sellers.length} student${sellers.length === 1 ? "" : "s"} open to this work`
            : "Search by skill or by course code."
        }
      />

      <div className="mb-6">
        <TagSearchBox autoFocus={!tag} />
      </div>

      {tag ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Minimum rating</span>
            {[
              { label: "Any", value: undefined },
              { label: "4+", value: "4" },
              { label: "4.5+", value: "4.5" },
            ].map((option) => {
              const active = (minRating ?? undefined) === option.value;
              const href = option.value ? `/search?tag=${tag.slug}&minRating=${option.value}` : `/search?tag=${tag.slug}`;
              return (
                <Link
                  key={option.label}
                  href={href}
                  className={
                    active
                      ? "font-mono text-sm font-medium text-brand-ink underline decoration-brand underline-offset-4"
                      : "font-mono text-sm text-ink-soft hover:text-ink"
                  }
                >
                  {option.label}
                </Link>
              );
            })}
            <span className="flex-1" />
            <ButtonLink href={`/requests/new?tag=${tag.slug}`} size="sm" variant="secondary">
              Post to all of them
            </ButtonLink>
          </div>

          {sellers.length === 0 ? (
            <EmptyState
              title="Nobody has this tag yet"
              body="Post an open request anyway — sellers are notified when they add this tag."
              action={<ButtonLink href={`/requests/new?tag=${tag.slug}`}>Post a request</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {sellers.map((seller) => (
                <li key={seller.userId}>
                  <CardLink href={`/sellers/${seller.handle}`} className="rounded-none border-0 bg-transparent px-0">
                    <div className="flex items-start gap-3">
                      <Avatar name={seller.displayName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{seller.displayName}</p>
                          {!seller.isAvailable ? <Badge tone="neutral">Paused</Badge> : null}
                        </div>
                        {seller.headline ? (
                          <p className="truncate text-sm text-ink-soft">{seller.headline}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Stars rating={seller.ratingAvg} count={seller.ratingCount} />
                          {seller.completedJobCount > 0 ? (
                            <span className="text-xs text-ink-faint">
                              {seller.completedJobCount} job{seller.completedJobCount === 1 ? "" : "s"} done
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {seller.fixedPriceCents ? (
                          <p>
                            <Price>{formatCents(seller.fixedPriceCents)}</Price>
                          </p>
                        ) : null}
                        {seller.hourlyRateCents ? (
                          <p className="text-xs text-ink-soft">
                            <Price className="text-xs">{formatCents(seller.hourlyRateCents)}/hr</Price>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </CardLink>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="grid gap-8 sm:grid-cols-[1fr_1fr]">
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Skills</h2>
            <ul className="mt-3 space-y-1.5">
              {serviceTags.map((t) => (
                <li key={t.id}>
                  <Link href={`/search?tag=${t.slug}`} className="text-sm hover:underline">
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Tutoring</h2>
            <div className="mt-3 space-y-4">
              {courseGroups.slice(0, 8).map((group) => (
                <div key={group.subject}>
                  <p className="text-xs text-ink-faint">{group.subject}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {group.tags.slice(0, 8).map((t) => (
                      <Link key={t.id} href={`/search?tag=${t.slug}`} className="font-mono text-sm hover:underline">
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-soft">Type a course code above if you don&rsquo;t see it.</p>
          </section>
        </div>
      )}
    </main>
  );
}
