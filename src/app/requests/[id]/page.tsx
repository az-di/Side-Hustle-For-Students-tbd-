import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { getRequestForViewer } from "@/modules/requests/queries";
import { REQUEST_STATUS_LABELS } from "@/modules/requests/state";
import { materializeExpiry } from "@/modules/requests/mutations";
import {
  acceptDirectRequestAction,
  cancelRequestAction,
  declineDirectRequestAction,
  selectResponseAction,
} from "@/app/actions/marketplace.actions";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Countdown,
  EmptyState,
  PageHeader,
  PayoutLine,
  Stars,
  TagChip,
} from "@/components/ui";
import { RespondForm } from "./respond-form";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // Opening a request is what writes down an expiry that has already happened.
  // No cron: expiry is derived on read, then materialized here.
  await materializeExpiry(id).catch(() => false);

  let detail;
  try {
    detail = await getRequestForViewer(id, viewer.id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const isLive =
    detail.request.effectiveStatus === "OPEN" || detail.request.effectiveStatus === "PENDING_SELLER";

  return (
    <main>
      <PageHeader
        title={detail.request.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={isLive ? "brand" : "neutral"}>
              {REQUEST_STATUS_LABELS[detail.request.effectiveStatus]}
            </Badge>
            {isLive ? <Countdown to={new Date(detail.request.expiresAt)} /> : null}
            {detail.request.tags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} kind={tag.kind} />
            ))}
          </span>
        }
      />

      <Card className="mb-4">
        <p className="whitespace-pre-wrap text-sm">{detail.request.details}</p>
      </Card>

      {detail.role === "BUYER" ? (
        <BuyerView detail={detail} />
      ) : (
        <SellerView detail={detail} />
      )}
    </main>
  );
}

// ─────────────────────────────── buyer's view ──────────────────────────────

function BuyerView({ detail }: { detail: Extract<Awaited<ReturnType<typeof getRequestForViewer>>, { role: "BUYER" }> }) {
  const { request, responses } = detail;
  const pending = responses.filter((r) => r.status === "PENDING");
  const isLive = request.effectiveStatus === "OPEN" || request.effectiveStatus === "PENDING_SELLER";

  return (
    <>
      {/* The buyer sees BOTH figures: their ceiling, and what to actually pay. */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Your budget</p>
            <p className="text-lg font-semibold">
              {request.budgetFixedCents ? formatCents(request.budgetFixedCents) : null}
              {request.budgetFixedCents && request.budgetHourlyCents ? " / " : null}
              {request.budgetHourlyCents ? `${formatCents(request.budgetHourlyCents)}/hr` : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Pay your seller</p>
            <p className="text-lg font-semibold text-money">
              {request.sellerSeesFixedCents ? formatCents(request.sellerSeesFixedCents) : null}
              {request.sellerSeesFixedCents && request.sellerSeesHourlyCents ? " / " : null}
              {request.sellerSeesHourlyCents ? `${formatCents(request.sellerSeesHourlyCents)}/hr` : null}
            </p>
          </div>
        </div>
        <p className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">
          Sellers only ever see the second number. HUSTL&rsquo;s 10% is <strong>waived in beta</strong> — Venmo
          them that amount directly.
        </p>
      </Card>

      {detail.jobId ? (
        <Card className="mb-4 border-brand/30 bg-brand-soft">
          <p className="text-sm font-medium text-brand-ink">You picked someone for this.</p>
          <ButtonLink href={`/jobs/${detail.jobId}`} size="sm" className="mt-2">
            Go to the job
          </ButtonLink>
        </Card>
      ) : null}

      <h2 className="mb-3 mt-6 text-sm font-semibold">
        {request.kind === "OPEN"
          ? `Responses (${pending.length})`
          : "Waiting on the seller"}
      </h2>

      {responses.length === 0 ? (
        <EmptyState
          title={isLive ? "No responses yet" : "Nobody responded"}
          body={
            isLive
              ? "Sellers with these tags were notified. This usually takes a few hours."
              : "This request closed without a match."
          }
        />
      ) : (
        <ul className="space-y-3">
          {responses.map((response) => (
            <li key={response.id}>
              <Card className={response.status === "SUPERSEDED" ? "opacity-60" : undefined}>
                <div className="flex items-start gap-3">
                  <Avatar name={response.seller.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/sellers/${response.seller.handle}`} className="font-medium hover:underline">
                        {response.seller.displayName}
                      </Link>
                      {response.status === "SELECTED" ? <Badge tone="money">Picked</Badge> : null}
                      {response.status === "SUPERSEDED" ? <Badge tone="neutral">Not picked</Badge> : null}
                    </div>
                    <div className="mt-0.5">
                      <Stars rating={response.seller.ratingAvg} count={response.seller.ratingCount} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{response.message}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {response.threadId ? (
                        <ButtonLink href={`/threads/${response.threadId}`} size="sm" variant="secondary">
                          Message
                        </ButtonLink>
                      ) : null}
                      {response.status === "PENDING" && isLive ? (
                        <form action={selectResponseAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="responseId" value={response.id} />
                          <Button type="submit" size="sm">
                            Pick {response.seller.displayName.split(" ")[0]}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {detail.canCancel ? (
        <form action={cancelRequestAction} className="mt-8">
          <input type="hidden" name="requestId" value={request.id} />
          <Button type="submit" variant="danger" size="sm">
            Cancel this request
          </Button>
        </form>
      ) : null}
    </>
  );
}

// ────────────────────────────── seller's view ──────────────────────────────

function SellerView({
  detail,
}: {
  detail: Extract<Awaited<ReturnType<typeof getRequestForViewer>>, { role: "SELLER" }>;
}) {
  const { request } = detail;

  // Everything money-shaped on this page is a payout. The DTO has no field
  // that could carry the buyer's budget.
  const payoutLabel = request.payoutFixedCents
    ? formatCents(request.payoutFixedCents)
    : request.payoutHourlyCents
      ? `${formatCents(request.payoutHourlyCents)}/hr`
      : "an amount to agree";

  return (
    <>
      <Card className="mb-4 border-money/20 bg-money-soft">
        <PayoutLine>
          {request.payoutFixedCents ? formatCents(request.payoutFixedCents) : null}
          {request.payoutFixedCents && request.payoutHourlyCents ? " / " : null}
          {request.payoutHourlyCents ? `${formatCents(request.payoutHourlyCents)}/hr` : null}
        </PayoutLine>
        <p className="mt-1 text-xs text-ink-soft">
          Paid directly by {request.buyer.displayName} over Venmo once you both mark the job complete.
        </p>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Avatar name={request.buyer.displayName} size={36} />
          <div>
            <p className="text-sm font-medium">{request.buyer.displayName}</p>
            <p className="text-xs text-ink-soft">Posted this request</p>
          </div>
        </div>
      </Card>

      {detail.jobId ? (
        <Card className="border-brand/30 bg-brand-soft">
          <p className="text-sm font-medium text-brand-ink">You got this one.</p>
          <ButtonLink href={`/jobs/${detail.jobId}`} size="sm" className="mt-2">
            Go to the job
          </ButtonLink>
        </Card>
      ) : detail.canAcceptDirect ? (
        <Card>
          <p className="mb-3 text-sm font-medium">
            {request.buyer.displayName} asked you directly. Accept to start the job.
          </p>
          <div className="flex gap-2">
            <form action={acceptDirectRequestAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit">Accept</Button>
            </form>
            <form action={declineDirectRequestAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit" variant="secondary">
                Decline
              </Button>
            </form>
          </div>
          {detail.threadId ? (
            <ButtonLink href={`/threads/${detail.threadId}`} variant="ghost" size="sm" className="mt-3">
              Ask a question first
            </ButtonLink>
          ) : null}
        </Card>
      ) : detail.myResponse ? (
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-medium">Your response</p>
            {detail.myResponse.status === "SUPERSEDED" ? <Badge tone="neutral">Not picked</Badge> : null}
            {detail.myResponse.status === "PENDING" ? <Badge tone="brand">Waiting</Badge> : null}
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{detail.myResponse.message}</p>
          {detail.threadId ? (
            <ButtonLink href={`/threads/${detail.threadId}`} size="sm" variant="secondary" className="mt-3">
              Open conversation
            </ButtonLink>
          ) : null}
        </Card>
      ) : detail.canRespond ? (
        <Card>
          <p className="mb-3 text-sm font-medium">Respond to this request</p>
          <RespondForm requestId={request.id} payoutLabel={payoutLabel} />
        </Card>
      ) : (
        <EmptyState
          title="You cannot respond to this one"
          body={
            request.effectiveStatus === "EXPIRED"
              ? "It expired."
              : request.isMatched
                ? "The buyer already picked someone."
                : "You are paused, so you are not taking new work. Resume in your seller settings."
          }
        />
      )}
    </>
  );
}
