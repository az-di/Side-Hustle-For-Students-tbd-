import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { listJobsForUser } from "@/modules/jobs/queries";
import {
  listBuyerRequests,
  listIncomingDirectRequests,
  listOpenRequestsForSeller,
} from "@/modules/requests/queries";
import { REQUEST_STATUS_LABELS } from "@/modules/requests/state";
import { JOB_STATUS_LABELS } from "@/modules/jobs/state";
import { TagSearchBox } from "@/components/tag-search-box";
import { LandingStudio } from "@/components/landing-studio";
import {
  Badge,
  ButtonLink,
  CardLink,
  Countdown,
  EmptyState,
  PayoutLine,
  Price,
} from "@/components/ui";

export default async function HomePage() {
  const viewer = await getViewer();
  if (!viewer) return <Landing />;

  const [incoming, feed, myRequests, jobs] = await Promise.all([
    viewer.isSeller ? listIncomingDirectRequests(viewer.id) : Promise.resolve([]),
    viewer.isSeller ? listOpenRequestsForSeller(viewer.id) : Promise.resolve([]),
    listBuyerRequests(viewer.id),
    listJobsForUser(viewer.id),
  ]);

  const toReview = jobs.filter((j) => j.needsReview);
  const activeJobs = jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "AWAITING_CONFIRMATION");
  const liveRequests = myRequests.filter(
    (r) => r.effectiveStatus === "OPEN" || r.effectiveStatus === "PENDING_SELLER",
  );

  const nextReview = toReview[0];
  const nextIncoming = !nextReview ? incoming[0] : undefined;
  const nextJob = !nextReview && !nextIncoming ? activeJobs[0] : undefined;
  const restIncoming = nextIncoming ? incoming.filter((r) => r.id !== nextIncoming.id) : incoming;
  const restJobs = nextJob ? activeJobs.filter((j) => j.id !== nextJob.id) : activeJobs;
  const restReview = nextReview ? toReview.filter((j) => j.id !== nextReview.id) : toReview;

  return (
    <main className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Hi {viewer.displayName.split(" ")[0]}
          </h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/requests/new" size="sm">
            Post a request
          </ButtonLink>
          <ButtonLink href="/search" size="sm" variant="secondary">
            Browse students
          </ButtonLink>
        </div>
      </section>

      <TagSearchBox />

      {nextReview ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Needs a review</h2>
          <CardLink href={`/jobs/${nextReview.id}`} className="border-warn/40 bg-warn-soft">
            <p className="font-display text-lg font-semibold">{nextReview.title}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Completed with {nextReview.counterparty.displayName} — leave a review.
            </p>
          </CardLink>
        </section>
      ) : nextIncoming ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Asked of you</h2>
          <CardLink href={`/requests/${nextIncoming.id}`} className="border-brand/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{nextIncoming.title}</p>
                <p className="text-sm text-ink-soft">Asked of you by {nextIncoming.buyer.displayName}</p>
              </div>
              <Countdown to={new Date(nextIncoming.expiresAt)} />
            </div>
            <div className="mt-2">
              <PayoutLine>
                {nextIncoming.payoutFixedCents
                  ? formatCents(nextIncoming.payoutFixedCents)
                  : nextIncoming.payoutHourlyCents
                    ? `${formatCents(nextIncoming.payoutHourlyCents)}/hr`
                    : "—"}
              </PayoutLine>
            </div>
          </CardLink>
        </section>
      ) : nextJob ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">In progress</h2>
          <CardLink href={`/jobs/${nextJob.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{nextJob.title}</p>
                <p className="text-sm text-ink-soft">
                  {nextJob.role === "SELLER" ? "for" : "with"} {nextJob.counterparty.displayName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge tone={nextJob.status === "AWAITING_CONFIRMATION" ? "warn" : "brand"}>
                  {JOB_STATUS_LABELS[nextJob.status]}
                </Badge>
                <p className="mt-1">
                  <Price>
                    {nextJob.amountCents ? formatCents(nextJob.amountCents) : "—"}
                    {nextJob.isHourly ? "/hr" : ""}
                  </Price>
                </p>
              </div>
            </div>
          </CardLink>
        </section>
      ) : null}

      {restReview.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Leave a review</h2>
          <ul className="divide-y divide-line border-y border-line">
            {restReview.map((job) => (
              <li key={job.id}>
                <CardLink href={`/jobs/${job.id}`} className="rounded-none border-0 bg-transparent px-0">
                  <p className="text-sm font-medium">{job.title}</p>
                  <p className="text-xs text-ink-soft">Completed with {job.counterparty.displayName}</p>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {restIncoming.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Asked of you directly</h2>
          <ul className="divide-y divide-line border-y border-line">
            {restIncoming.map((request) => (
              <li key={request.id}>
                <CardLink href={`/requests/${request.id}`} className="rounded-none border-0 bg-transparent px-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">from {request.buyer.displayName}</p>
                    </div>
                    <Countdown to={new Date(request.expiresAt)} />
                  </div>
                  <div className="mt-2">
                    <PayoutLine>
                      {request.payoutFixedCents
                        ? formatCents(request.payoutFixedCents)
                        : request.payoutHourlyCents
                          ? `${formatCents(request.payoutHourlyCents)}/hr`
                          : "—"}
                    </PayoutLine>
                  </div>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {restJobs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Active jobs</h2>
          <ul className="divide-y divide-line border-y border-line">
            {restJobs.map((job) => (
              <li key={job.id}>
                <CardLink href={`/jobs/${job.id}`} className="rounded-none border-0 bg-transparent px-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-ink-soft">
                        {job.role === "SELLER" ? "for" : "with"} {job.counterparty.displayName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={job.status === "AWAITING_CONFIRMATION" ? "warn" : "brand"}>
                        {JOB_STATUS_LABELS[job.status]}
                      </Badge>
                      <p className="mt-1">
                        <Price className="text-sm">
                          {job.amountCents ? formatCents(job.amountCents) : "—"}
                          {job.isHourly ? "/hr" : ""}
                        </Price>
                      </p>
                    </div>
                  </div>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {viewer.isSeller ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-soft">Open in your tags</h2>
            <Link href="/settings/seller" className="text-xs text-ink-faint underline hover:text-ink-soft">
              Manage tags
            </Link>
          </div>
          {feed.length === 0 ? (
            <EmptyState
              title="Nothing open right now"
              body="When a student posts a request with one of your tags, it shows up here and you get a notification."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {feed.map((request) => (
                <li key={request.id}>
                  <CardLink href={`/requests/${request.id}`} className="rounded-none border-0 bg-transparent px-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{request.title}</p>
                        <p className="font-mono text-xs text-ink-soft">
                          {request.buyer.displayName} · {request.tags.map((t) => t.name).join(" · ")}
                        </p>
                      </div>
                      <Countdown to={new Date(request.expiresAt)} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{request.details}</p>
                    <div className="mt-2">
                      <PayoutLine>
                        {request.payoutFixedCents
                          ? formatCents(request.payoutFixedCents)
                          : request.payoutHourlyCents
                            ? `${formatCents(request.payoutHourlyCents)}/hr`
                            : "—"}
                      </PayoutLine>
                    </div>
                  </CardLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-soft">
          Have a skill?{" "}
          <Link href="/settings/seller" className="underline hover:text-ink">
            Start selling
          </Link>
        </p>
      )}

      {liveRequests.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Your open requests</h2>
          <ul className="divide-y divide-line border-y border-line">
            {liveRequests.map((request) => (
              <li key={request.id}>
                <CardLink href={`/requests/${request.id}`} className="rounded-none border-0 bg-transparent px-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">
                        {REQUEST_STATUS_LABELS[request.effectiveStatus]} · {request.responseCount} response
                        {request.responseCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Countdown to={new Date(request.expiresAt)} />
                  </div>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Landing() {
  return (
    <main>
      <LandingStudio />
    </main>
  );
}
