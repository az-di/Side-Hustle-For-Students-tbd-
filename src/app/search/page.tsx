import Link from "next/link";
import { getTagBySlug, listSellersForTag, listServiceTags } from "@/modules/catalog/queries";
import { formatCents } from "@/lib/money";
import { TagSearchBox } from "@/components/tag-search-box";
import { Avatar, Badge, ButtonLink, Card, CardLink, EmptyState, PageHeader, Stars } from "@/components/ui";

export const metadata = { title: "Find someone · HUSTL" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; minRating?: string }>;
}) {
  const { tag: tagSlug, minRating } = await searchParams;
  const tag = tagSlug ? await getTagBySlug(tagSlug) : null;
  const minRatingNum = minRating ? Number(minRating) : undefined;

  const sellers = tag
    ? await listSellersForTag({ tagId: tag.id, minRating: Number.isFinite(minRatingNum) ? minRatingNum : undefined })
    : [];
  const serviceTags = tag ? [] : await listServiceTags();

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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">Minimum rating:</span>
            {[
              { label: "Any", value: undefined },
              { label: "4★+", value: "4" },
              { label: "4.5★+", value: "4.5" },
            ].map((option) => {
              const active = (minRating ?? undefined) === option.value;
              const href = option.value ? `/search?tag=${tag.slug}&minRating=${option.value}` : `/search?tag=${tag.slug}`;
              return (
                <Link
                  key={option.label}
                  href={href}
                  className={
                    active
                      ? "rounded-full border border-brand bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink"
                      : "rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-ink-faint"
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
            <ul className="space-y-3">
              {sellers.map((seller) => (
                <li key={seller.userId}>
                  <CardLink href={`/sellers/${seller.handle}`}>
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
                        {/* Seller-authored prices are stored net: shown exactly as typed. */}
                        {seller.fixedPriceCents ? (
                          <p className="font-semibold">{formatCents(seller.fixedPriceCents)}</p>
                        ) : null}
                        {seller.hourlyRateCents ? (
                          <p className="text-xs text-ink-soft">{formatCents(seller.hourlyRateCents)}/hr</p>
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
        <Card>
          <p className="mb-3 text-sm font-medium">Browse by service</p>
          <div className="flex flex-wrap gap-2">
            {serviceTags.map((t) => (
              <Link
                key={t.id}
                href={`/search?tag=${t.slug}`}
                className="rounded-full border border-line bg-canvas px-3 py-1.5 text-sm hover:border-brand/40 hover:bg-brand-soft"
              >
                {t.name}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            Tutoring is organised by course code — type a code like “MATH 124” or “CSE 143” above.
          </p>
        </Card>
      )}
    </main>
  );
}
