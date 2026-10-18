import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import {
  listBuyerRequests,
  listIncomingDirectRequests,
  listMyResponses,
  listOpenRequestsForSeller,
} from "@/modules/requests/queries";
import { REQUEST_STATUS_LABELS } from "@/modules/requests/state";
import {
  Badge,
  ButtonLink,
  CardLink,
  Countdown,
  EmptyState,
  PageHeader,
  PayoutLine,
} from "@/components/ui";

export const metadata = { title: "Requests · HUSTL" };

export default async function RequestsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [mine, incoming, feed, responses] = await Promise.all([
    listBuyerRequests(viewer.id),
    viewer.isSeller ? listIncomingDirectRequests(viewer.id) : Promise.resolve([]),
    viewer.isSeller ? listOpenRequestsForSeller(viewer.id) : Promise.resolve([]),
    viewer.isSeller ? listMyResponses(viewer.id) : Promise.resolve([]),
  ]);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Requests"
        action={
          <ButtonLink href="/requests/new" size="sm">
            New
          </ButtonLink>
        }
      />

      {viewer.isSeller ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Open to respond to ({feed.length})</h2>
            {feed.length === 0 ? (
              <EmptyState title="Nothing open in your tags right now" />
            ) : (
              <ul className="space-y-2">
                {feed.map((request) => (
                  <li key={request.id}>
                    <CardLink href={`/requests/${request.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{request.title}</p>
                          <p className="text-xs text-ink-soft">{request.buyer.displayName}</p>
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
            )}
          </section>

          {incoming.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Sent to you directly ({incoming.length})</h2>
              <ul className="space-y-2">
                {incoming.map((request) => (
                  <li key={request.id}>
                    <CardLink href={`/requests/${request.id}`} className="border-brand/30">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">from {request.buyer.displayName}</p>
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

          {responses.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">You responded to</h2>
              <ul className="space-y-2">
                {responses.map((item) => (
                  <li key={item.responseId}>
                    <CardLink
                      href={`/requests/${item.request.id}`}
                      className={item.status === "SUPERSEDED" ? "opacity-60" : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium">{item.request.title}</p>
                        <Badge
                          tone={
                            item.status === "SELECTED" ? "money" : item.status === "PENDING" ? "brand" : "neutral"
                          }
                        >
                          {item.status === "SELECTED"
                            ? "You got it"
                            : item.status === "PENDING"
                              ? "Waiting"
                              : "Not picked"}
                        </Badge>
                      </div>
                    </CardLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Requests you posted</h2>
        {mine.length === 0 ? (
          <EmptyState
            title="You have not posted anything yet"
            body="Describe what you need and set a budget — students with matching tags are notified."
            action={<ButtonLink href="/requests/new">Post a request</ButtonLink>}
          />
        ) : (
          <ul className="space-y-2">
            {mine.map((request) => (
              <li key={request.id}>
                <CardLink href={`/requests/${request.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.title}</p>
                      <p className="text-xs text-ink-soft">
                        {REQUEST_STATUS_LABELS[request.effectiveStatus]}
                        {request.kind === "OPEN"
                          ? ` · ${request.responseCount} response${request.responseCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {/* Buyer's own view: their ceiling is theirs to see. */}
                      <p className="text-sm font-semibold">
                        {request.budgetFixedCents
                          ? formatCents(request.budgetFixedCents)
                          : request.budgetHourlyCents
                            ? `${formatCents(request.budgetHourlyCents)}/hr`
                            : "—"}
                      </p>
                      <p className="text-[11px] text-ink-faint">
                        they see{" "}
                        {request.sellerSeesFixedCents
                          ? formatCents(request.sellerSeesFixedCents)
                          : request.sellerSeesHourlyCents
                            ? `${formatCents(request.sellerSeesHourlyCents)}/hr`
                            : "—"}
                      </p>
                    </div>
                  </div>
                </CardLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
