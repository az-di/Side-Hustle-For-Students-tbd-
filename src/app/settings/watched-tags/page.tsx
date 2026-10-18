import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listInterests } from "@/modules/interests/queries";
import { WATCH_WINDOW_DAYS } from "@/modules/interests/state";
import { setAllWatchedTagsAction, setWatchedTagAction } from "@/app/actions/settings.actions";
import { Badge, Button, Card, EmptyState, PageHeader, RelativeTime, TagChip } from "@/components/ui";

export const metadata = { title: "Watched tags · HUSTL" };

/**
 * The off switch for "a seller just opened up to a tag you asked for". Without
 * this screen the alert is the app's main spam source, so it ships with it.
 */
export default async function WatchedTagsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const interests = await listInterests(viewer.id);
  const anyOn = interests.some((i) => i.notifyOnNewSeller);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Watched tags"
        subtitle={`When you post a request under a tag, we tell you if a seller becomes open to it in the next ${WATCH_WINDOW_DAYS} days — at most once per seller per tag per month.`}
        action={
          interests.length > 0 ? (
            <form action={setAllWatchedTagsAction}>
              <input type="hidden" name="on" value={anyOn ? "false" : "true"} />
              <Button type="submit" size="sm" variant="secondary">
                {anyOn ? "Turn all off" : "Turn all on"}
              </Button>
            </form>
          ) : undefined
        }
      />

      {interests.length === 0 ? (
        <EmptyState
          title="Nothing watched yet"
          body="Post a request and its tags show up here."
          action={
            <Link href="/requests/new" className="text-sm text-brand underline">
              Post a request
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {interests.map((interest) => (
            <li key={interest.tagId}>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/search?tag=${interest.slug}`}>
                        <TagChip name={interest.name} kind={interest.kind} />
                      </Link>
                      {!interest.notifyOnNewSeller ? (
                        <Badge tone="neutral">off</Badge>
                      ) : !interest.active ? (
                        <Badge tone="neutral">lapsed</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      last requested <RelativeTime date={interest.lastRequestedAt} />
                      {!interest.active && interest.notifyOnNewSeller
                        ? ` · post again to watch for another ${WATCH_WINDOW_DAYS} days`
                        : null}
                    </p>
                  </div>
                  <form action={setWatchedTagAction}>
                    <input type="hidden" name="tagId" value={interest.tagId} />
                    <input type="hidden" name="on" value={interest.notifyOnNewSeller ? "false" : "true"} />
                    <Button type="submit" size="sm" variant={interest.notifyOnNewSeller ? "secondary" : "primary"}>
                      {interest.notifyOnNewSeller ? "Stop" : "Watch"}
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
