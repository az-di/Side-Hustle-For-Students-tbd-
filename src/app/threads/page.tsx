import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listThreadsForUser } from "@/modules/messaging/queries";
import { Avatar, Badge, CardLink, EmptyState, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Messages · HUSTL" };

export default async function ThreadsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const threads = await listThreadsForUser(viewer.id);

  return (
    <main>
      <PageHeader title="Messages" />

      {threads.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Messaging opens up when you send a request or respond to one — nobody can cold-message you here."
        />
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <CardLink href={`/threads/${thread.id}`} className={thread.unread ? "border-brand/40" : undefined}>
                <div className="flex items-start gap-3">
                  <Avatar name={thread.counterparty.displayName} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{thread.counterparty.displayName}</p>
                      {thread.unread ? <Badge tone="brand">New</Badge> : null}
                      <span className="flex-1" />
                      <RelativeTime date={thread.lastMessageAt} />
                    </div>
                    <p className="truncate text-xs text-ink-soft">{thread.title}</p>
                    {thread.lastMessage ? (
                      <p className="mt-1 truncate text-sm text-ink-soft">{thread.lastMessage}</p>
                    ) : null}
                  </div>
                </div>
              </CardLink>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
