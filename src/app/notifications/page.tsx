import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listNotificationsForUser } from "@/modules/messaging/queries";
import { markAllReadAction } from "@/app/actions/marketplace.actions";
import { Button, Card, EmptyState, PageHeader, RelativeTime } from "@/components/ui";
import type { NotificationKind } from "@/generated/prisma/enums";

export const metadata = { title: "Notifications · HUSTL" };

/**
 * Notification copy lives here, not in the database.
 *
 * Rows carry ids only — no rendered strings — precisely so that money can be
 * rendered per viewer. A stored string like "New request: $100 for photos"
 * would be role-blind and would ship the buyer's ceiling to every seller in the
 * tag. Nothing on this page shows an amount at all.
 */
const COPY: Record<NotificationKind, (actor: string, title: string) => string> = {
  DIRECT_REQUEST_RECEIVED: (actor) => `${actor} asked you directly`,
  OPEN_REQUEST_IN_TAG: (_actor, title) => `New request in your tags: ${title}`,
  RESPONSE_RECEIVED: (actor) => `${actor} responded to your request`,
  RESPONSE_SELECTED: (actor) => `${actor} picked you — the job is on`,
  RESPONSE_NOT_SELECTED: (_actor, title) => `Not picked for ${title}`,
  REQUEST_DECLINED: (actor) => `${actor} declined your request`,
  REQUEST_CANCELLED: (actor) => `${actor} cancelled their request`,
  REQUEST_EXPIRED: (_actor, title) => `Your request expired: ${title}`,
  JOB_STARTED: (actor) => `${actor} accepted — the job has started`,
  COMPLETION_REQUESTED: (actor) => `${actor} marked the job complete — confirm it`,
  JOB_COMPLETED: (_actor, title) => `Job complete: ${title}`,
  JOB_AUTO_COMPLETED: (_actor, title) => `Auto-confirmed after the waiting period: ${title}`,
  JOB_CANCELLED: (actor) => `${actor} cancelled the job`,
  REVIEW_RECEIVED: (actor) => `${actor} left you a review`,
  MESSAGE_RECEIVED: (actor) => `${actor} sent you a message`,
};

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const notifications = await listNotificationsForUser(viewer.id);
  const unread = notifications.filter((n) => n.readAt === null).length;

  return (
    <main>
      <PageHeader
        title="Notifications"
        action={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" size="sm" variant="secondary">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="You will hear about new requests in your tags, responses, and job updates here."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const title = n.request?.title ?? n.job?.request.title ?? "a request";
            const actor = n.actor?.displayName ?? "Someone";
            const href = n.jobId
              ? `/jobs/${n.jobId}`
              : n.threadId
                ? `/threads/${n.threadId}`
                : n.requestId
                  ? `/requests/${n.requestId}`
                  : "/";

            return (
              <li key={n.id}>
                <Link href={href} className="block">
                  <Card className={n.readAt === null ? "border-brand/40 bg-brand-soft/40" : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm">{COPY[n.kind](actor, title)}</p>
                      <RelativeTime date={n.createdAt} />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
