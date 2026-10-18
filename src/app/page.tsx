import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { listServiceTags } from "@/modules/catalog/queries";
import { listJobsForUser } from "@/modules/jobs/queries";
import {
  listBuyerRequests,
  listIncomingDirectRequests,
  listOpenRequestsForSeller,
} from "@/modules/requests/queries";
import { REQUEST_STATUS_LABELS } from "@/modules/requests/state";
import { JOB_STATUS_LABELS } from "@/modules/jobs/state";
import { TagSearchBox } from "@/components/tag-search-box";
import {
  Badge,
  ButtonLink,
  Card,
  CardLink,
  Countdown,
  EmptyState,
  PayoutLine,
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

  const activeJobs = jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "AWAITING_CONFIRMATION");
  const toReview = jobs.filter((j) => j.needsReview);
  const liveRequests = myRequests.filter(
    (r) => r.effectiveStatus === "OPEN" || r.effectiveStatus === "PENDING_SELLER",
  );

  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Hi {viewer.displayName.split(" ")[0]}</h1>
        <div className="mt-3">
          <TagSearchBox />
        </div>
        <div className="mt-3 flex gap-2">
          <ButtonLink href="/requests/new" size="sm">
            Post a request
          </ButtonLink>
          <ButtonLink href="/search" size="sm" variant="secondary">
            Browse students
          </ButtonLink>
        </div>
      </section>

      {toReview.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Leave a review</h2>
          <ul className="space-y-2">
            {toReview.map((job) => (
              <li key={job.id}>
                <CardLink href={`/jobs/${job.id}`} className="border-warn/30 bg-warn-soft">
                  <p className="text-sm font-medium">{job.title}</p>
                  <p className="text-xs text-ink-soft">
                    Completed with {job.counterparty.displayName} — tell people how it went.
                  </p>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {incoming.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Asked of you directly</h2>
          <ul className="space-y-2">
            {incoming.map((request) => (
              <li key={request.id}>
                <CardLink href={`/requests/${request.id}`} className="border-brand/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">from {request.buyer.displayName}</p>
                    </div>
                    <Countdown to={new Date(request.expiresAt)} />
                  </div>
                  <div className="mt-2">
                    {/* Seller surface: payout only. */}
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

      {activeJobs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Active jobs</h2>
          <ul className="space-y-2">
            {activeJobs.map((job) => (
              <li key={job.id}>
                <CardLink href={`/jobs/${job.id}`}>
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
                      <p className="mt-1 text-sm font-semibold text-money">
                        {job.amountCents ? formatCents(job.amountCents) : "—"}
                        {job.isHourly ? "/hr" : ""}
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
            <h2 className="text-sm font-semibold">Open requests in your tags</h2>
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
            <ul className="space-y-2">
              {feed.map((request) => (
                <li key={request.id}>
                  <CardLink href={`/requests/${request.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{request.title}</p>
                        <p className="text-xs text-ink-soft">
                          {request.buyer.displayName} ·{" "}
                          {request.tags.map((t) => t.name).join(", ")}
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
        <section>
          <Card className="border-brand/30 bg-brand-soft">
            <p className="text-sm font-medium text-brand-ink">Have a skill?</p>
            <p className="mt-1 text-sm text-ink-soft">
              Set up a seller profile and students can hire you for photos, design, video, music or tutoring.
            </p>
            <ButtonLink href="/settings/seller" size="sm" className="mt-3">
              Start selling
            </ButtonLink>
          </Card>
        </section>
      )}

      {liveRequests.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Your open requests</h2>
          <ul className="space-y-2">
            {liveRequests.map((request) => (
              <li key={request.id}>
                <CardLink href={`/requests/${request.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">
                        {REQUEST_STATUS_LABELS[request.effectiveStatus]} ·{" "}
                        {request.responseCount} response{request.responseCount === 1 ? "" : "s"}
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

async function Landing() {
  const tags = await listServiceTags();

  return (
    <main>
      <section className="py-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Hire other UW students
          <br />
          <span className="text-brand">for creative work</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
          Photos, posters, video, music, tutoring. Cheaper than Fiverr, and it&rsquo;s someone you can actually
          meet on campus. UW email required on both sides.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <ButtonLink href="/login" size="lg">
            Sign in with UW email
          </ButtonLink>
        </div>
      </section>

      <Card className="mt-4">
        <p className="mb-3 text-sm font-medium">What students hire each other for</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className="rounded-full border border-line bg-canvas px-3 py-1.5 text-sm">
              {tag.name}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Plus tutoring by course code — MATH 124, CSE 143, CHEM 142 and more.
        </p>
      </Card>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { title: "Verified students only", body: "Everyone signs in with a @uw.edu address. No strangers." },
          { title: "Reviews that mean something", body: "You can only review a job you actually completed." },
          { title: "No 20% platform fee", body: "You pay your seller directly. HUSTL's cut is waived in beta." },
        ].map((item) => (
          <Card key={item.title}>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-xs text-ink-soft">{item.body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
