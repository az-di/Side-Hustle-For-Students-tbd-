import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getSellerByHandle } from "@/modules/catalog/queries";
import { relationshipWith } from "@/modules/trust/queries";
import { SafetyMenu } from "@/components/safety-menu";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  RelativeTime,
  Stars,
  TagChip,
} from "@/components/ui";

export default async function SellerProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [seller, viewer] = await Promise.all([getSellerByHandle(handle), getViewer()]);
  if (!seller) notFound();

  const profile = seller.sellerProfile;
  const isMe = viewer?.id === seller.id;
  const relationship = viewer && !isMe ? await relationshipWith(viewer.id, seller.id) : null;

  // A blocked pair sees a stub, not a profile — and the same stub whichever
  // way the block runs, so a blocked person cannot tell.
  if (relationship?.blocked) {
    return (
      <main>
        <div className="mb-5 flex items-start gap-4">
          <Avatar name={seller.displayName} size={64} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{seller.displayName}</h1>
            <p className="text-sm text-ink-soft">@{seller.handle}</p>
          </div>
        </div>
        <EmptyState
          title="This profile is not available"
          body={relationship.blockedByMe ? "You blocked this person." : undefined}
          action={relationship.blockedByMe ? <SafetyMenu handle={seller.handle} blockedByMe canReport={false} /> : undefined}
        />
      </main>
    );
  }

  if (seller.status !== "ACTIVE" && !isMe && !viewer?.isAdmin) {
    return (
      <main>
        <EmptyState title="This account is not active" body="It is not taking requests or messages right now." />
      </main>
    );
  }

  return (
    <main>
      <div className="mb-5 flex items-start gap-4">
        <Avatar name={seller.displayName} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{seller.displayName}</h1>
            {profile && !profile.isAvailable ? <Badge tone="neutral">Paused</Badge> : null}
          </div>
          <p className="text-sm text-ink-soft">@{seller.handle}</p>
          {profile ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={profile.ratingAvg} count={profile.ratingCount} />
              {profile.completedJobCount > 0 ? (
                <span className="text-xs text-ink-faint">
                  {profile.completedJobCount} job{profile.completedJobCount === 1 ? "" : "s"} completed
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isMe ? (
        <ButtonLink href="/settings/seller" variant="secondary" size="sm" className="mb-5">
          Edit your profile
        </ButtonLink>
      ) : profile ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <ButtonLink href={`/requests/new?seller=${seller.handle}`} size="sm">
            {profile.isAvailable ? "Request from them" : "Paused — not taking requests"}
          </ButtonLink>
          {relationship ? (
            <SafetyMenu handle={seller.handle} blockedByMe={false} canReport={relationship.canReport} />
          ) : null}
        </div>
      ) : relationship ? (
        <div className="mb-5">
          <SafetyMenu handle={seller.handle} blockedByMe={false} canReport={relationship.canReport} />
        </div>
      ) : null}

      {profile?.headline ? <p className="mb-2 font-medium">{profile.headline}</p> : null}
      {profile?.about ? <p className="mb-5 whitespace-pre-wrap text-sm text-ink-soft">{profile.about}</p> : null}
      {!profile && seller.bio ? <p className="mb-5 text-sm text-ink-soft">{seller.bio}</p> : null}

      {!profile ? (
        <EmptyState
          title={`${seller.displayName} is not selling`}
          body="This account posts requests but does not offer services."
        />
      ) : (
        <>
          {seller.tags.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">Open to</h2>
              <div className="flex flex-wrap gap-2">
                {seller.tags.map((tag) => (
                  <Link key={tag.id} href={`/search?tag=${tag.slug}`}>
                    <TagChip name={tag.name} kind={tag.kind} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {(profile.fixedPriceCents || profile.hourlyRateCents) ? (
            <Card className="mb-6">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Typical rate</p>
              {/*
                Seller-authored prices are stored NET, so they render exactly as
                the seller typed them — never grossed up on their own profile.
              */}
              <p className="mt-0.5 text-lg font-semibold">
                {profile.fixedPriceCents ? formatCents(profile.fixedPriceCents) : null}
                {profile.fixedPriceCents && profile.hourlyRateCents ? " · " : null}
                {profile.hourlyRateCents ? `${formatCents(profile.hourlyRateCents)}/hr` : null}
              </p>
            </Card>
          ) : null}

          {seller.listings.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">Services</h2>
              <ul className="space-y-3">
                {seller.listings.map((listing) => (
                  <li key={listing.id}>
                    <Card>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{listing.title}</p>
                        <div className="shrink-0 text-right">
                          {listing.fixedPriceCents ? (
                            <p className="font-semibold">{formatCents(listing.fixedPriceCents)}</p>
                          ) : null}
                          {listing.hourlyRateCents ? (
                            <p className="text-sm text-ink-soft">{formatCents(listing.hourlyRateCents)}/hr</p>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{listing.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {listing.tags.map((t) => (
                          <TagChip key={t.tag.slug} name={t.tag.name} kind={t.tag.kind} />
                        ))}
                        {listing.turnaroundDays ? (
                          <span className="text-xs text-ink-faint">
                            usually {listing.turnaroundDays} day{listing.turnaroundDays === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      {!isMe && profile.isAvailable ? (
                        <ButtonLink
                          href={`/requests/new?listing=${listing.id}`}
                          size="sm"
                          variant="secondary"
                          className="mt-3"
                        >
                          Request this
                        </ButtonLink>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.portfolioLinks.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">Portfolio</h2>
              <ul className="space-y-1.5">
                {profile.portfolioLinks.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all text-sm text-brand underline hover:text-brand-ink"
                    >
                      {link.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-sm font-semibold">
              Reviews {profile.ratingCount > 0 ? `(${profile.ratingCount})` : ""}
            </h2>
            {seller.reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                body="Reviews can only be left after a job is actually completed, so there are no fake ones."
              />
            ) : (
              <ul className="space-y-3">
                {seller.reviews.map((review) => (
                  <li key={review.id}>
                    <Card>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Stars rating={review.rating} count={1} />
                          <p className="mt-0.5 truncate text-xs text-ink-soft">
                            {review.buyer.displayName} · {review.job.request.title}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <RelativeTime date={review.createdAt} />
                          {review.job.completionSource === "AUTO" ? (
                            <p className="mt-0.5">
                              <Badge tone="warn">auto-confirmed</Badge>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {review.body ? <p className="mt-2 text-sm">{review.body}</p> : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
