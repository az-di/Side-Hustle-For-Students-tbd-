import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { getJobForViewer } from "@/modules/jobs/queries";
import { JOB_STATUS_LABELS } from "@/modules/jobs/state";
import { rejectCompletionAction } from "@/app/actions/marketplace.actions";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  PayoutLine,
  Stars,
} from "@/components/ui";
import { ConfirmCompleteButton, MarkCompleteButton, ReviewForm } from "./job-actions";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  let job;
  try {
    // getJobForViewer also materializes an overdue auto-completion.
    job = await getJobForViewer(id, viewer.id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const counterparty = job.role === "SELLER" ? job.buyer : job.seller;
  const iMarkedComplete = job.completionRequestedById === viewer.id;

  return (
    <main>
      <PageHeader
        title={job.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={job.status === "COMPLETED" ? "money" : job.status === "CANCELLED" ? "neutral" : "brand"}>
              {JOB_STATUS_LABELS[job.status]}
            </Badge>
            {job.completionSource === "AUTO" ? <Badge tone="warn">Auto-confirmed</Badge> : null}
          </span>
        }
      />

      {/* Money, per role. Sellers get a payout line and nothing else. */}
      <Card className="mb-4 border-money/20 bg-money-soft">
        {job.role === "SELLER" ? (
          <>
            <PayoutLine>
              {job.payoutFixedCents ? formatCents(job.payoutFixedCents) : null}
              {job.payoutFixedCents && job.payoutHourlyCents ? " / " : null}
              {job.payoutHourlyCents ? `${formatCents(job.payoutHourlyCents)}/hr` : null}
            </PayoutLine>
            <p className="mt-1 text-xs text-ink-soft">
              {job.buyer.displayName} pays you directly over Venmo.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Your budget</p>
                <p className="font-semibold">
                  {job.budgetFixedCents ? formatCents(job.budgetFixedCents) : null}
                  {job.budgetFixedCents && job.budgetHourlyCents ? " / " : null}
                  {job.budgetHourlyCents ? `${formatCents(job.budgetHourlyCents)}/hr` : null}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-ink-faint">Venmo them</p>
                <p className="text-lg font-semibold text-money">
                  {job.payTheSellerFixedCents ? formatCents(job.payTheSellerFixedCents) : null}
                  {job.payTheSellerFixedCents && job.payTheSellerHourlyCents ? " / " : null}
                  {job.payTheSellerHourlyCents ? `${formatCents(job.payTheSellerHourlyCents)}/hr` : null}
                </p>
              </div>
            </div>
            <p className="mt-2 border-t border-money/20 pt-2 text-xs text-ink-soft">
              HUSTL&rsquo;s 10% is waived in beta, so the seller keeps the full amount above. They never saw your
              budget.
            </p>
          </>
        )}
      </Card>

      {/* Venmo handles: shown only to the two people on this job. */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={counterparty.displayName} />
          <div className="min-w-0 flex-1">
            <Link href={`/sellers/${counterparty.handle}`} className="font-medium hover:underline">
              {counterparty.displayName}
            </Link>
            <p className="text-xs text-ink-soft">{job.role === "SELLER" ? "Your buyer" : "Your seller"}</p>
          </div>
          {job.threadId ? (
            <ButtonLink href={`/threads/${job.threadId}`} size="sm" variant="secondary">
              Messages
            </ButtonLink>
          ) : null}
        </div>
        <div className="mt-3 border-t border-line pt-3 text-sm">
          {counterparty.venmoHandle ? (
            <p>
              Venmo: <span className="font-mono font-medium">{counterparty.venmoHandle}</span>
            </p>
          ) : (
            <p className="text-ink-soft">
              {counterparty.displayName} has not added a Venmo handle — ask them in messages.
            </p>
          )}
          {!viewer.venmoHandle ? (
            <p className="mt-1 text-xs text-warn">
              You have not added yours.{" "}
              <Link href="/settings/seller" className="underline">
                Add it
              </Link>{" "}
              so they can pay you without asking.
            </p>
          ) : null}
        </div>
      </Card>

      {/* The completion handshake. */}
      {job.status === "IN_PROGRESS" ? (
        <Card>
          <p className="mb-1 text-sm font-medium">Is the work done?</p>
          <p className="mb-3 text-xs text-ink-soft">
            Either of you can mark it complete; the other confirms. Reviews unlock after that.
          </p>
          <MarkCompleteButton jobId={job.id} />
        </Card>
      ) : null}

      {job.status === "AWAITING_CONFIRMATION" ? (
        <Card className="border-warn/30 bg-warn-soft">
          {iMarkedComplete ? (
            <>
              <p className="text-sm font-medium text-warn">
                You marked this complete — waiting on {counterparty.displayName}.
              </p>
              {job.autoCompleteAt ? (
                <p className="mt-1 text-xs text-ink-soft">
                  If they do not respond, it auto-confirms on{" "}
                  {new Date(job.autoCompleteAt).toLocaleString()}, so a job can never be stuck forever.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mb-1 text-sm font-medium text-warn">
                {counterparty.displayName} marked this complete.
              </p>
              <p className="mb-3 text-xs text-ink-soft">
                Confirm if the work is done{job.role === "BUYER" ? " and you have paid them" : ""}.
              </p>
              <div className="flex flex-wrap gap-2">
                <ConfirmCompleteButton jobId={job.id} />
                <form action={rejectCompletionAction}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <Button type="submit" variant="secondary">
                    Not done yet
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {/* Reviews: buyers only, completed jobs only. */}
      {job.status === "COMPLETED" ? (
        job.role === "BUYER" ? (
          job.review ? (
            <Card>
              <p className="mb-2 text-sm font-medium">Your review</p>
              <Stars rating={job.review.rating} count={1} />
              {job.review.body ? <p className="mt-2 text-sm text-ink-soft">{job.review.body}</p> : null}
            </Card>
          ) : (
            <Card>
              <p className="mb-3 text-sm font-medium">Leave a review</p>
              <ReviewForm jobId={job.id} sellerName={job.seller.displayName} />
            </Card>
          )
        ) : (
          <Card>
            <p className="text-sm font-medium">Job complete</p>
            {job.review ? (
              <div className="mt-2">
                <Stars rating={job.review.rating} count={1} />
                {job.review.body ? <p className="mt-2 text-sm text-ink-soft">{job.review.body}</p> : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-soft">
                {job.buyer.displayName} has not left a review yet.
              </p>
            )}
          </Card>
        )
      ) : null}
    </main>
  );
}
