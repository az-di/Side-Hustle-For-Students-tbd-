import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listNotificationsForUser } from "@/modules/messaging/queries";
import { NOTIFICATION_COPY as COPY, notificationContext, notificationHref } from "@/modules/notifications/copy";
import { markAllReadAction } from "@/app/actions/marketplace.actions";
import { Button, Card, EmptyState, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Notifications · HUSTL" };

// Copy lives in modules/notifications/copy.ts (shared with email). Rows carry
// ids only, so nothing on this page can show an amount.

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
            const href = notificationHref(n);

            return (
              <li key={n.id}>
                <Link href={href} className="block">
                  <Card className={n.readAt === null ? "border-brand/40 bg-brand-soft/40" : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm">{COPY[n.kind](notificationContext(n))}</p>
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
