import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listBlockedUsers, listMyReports } from "@/modules/trust/queries";
import { REPORT_KIND_LABELS } from "@/modules/trust/state";
import { unblockUserAction } from "@/app/actions/trust.actions";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Safety · HUSTL" };

export default async function SafetySettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [blocked, reports] = await Promise.all([listBlockedUsers(viewer.id), listMyReports(viewer.id)]);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Safety"
        subtitle="People you have blocked, and reports you have sent. Nobody is told that you blocked or reported them."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Blocked ({blocked.length})</h2>
        {blocked.length === 0 ? (
          <EmptyState
            title="You have not blocked anyone"
            body="Block someone from their profile, a conversation, or a job page. Blocking is mutual: neither of you can reach the other."
          />
        ) : (
          <ul className="space-y-2">
            {blocked.map((person) => (
              <li key={person.id}>
                <Card>
                  <div className="flex items-center gap-3">
                    <Avatar name={person.displayName} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/sellers/${person.handle}`} className="text-sm font-medium hover:underline">
                        {person.displayName}
                      </Link>
                      <p className="text-xs text-ink-soft">
                        blocked <RelativeTime date={person.blockedAt} />
                      </p>
                    </div>
                    <form action={unblockUserAction}>
                      <input type="hidden" name="handle" value={person.handle} />
                      <Button type="submit" size="sm" variant="secondary">
                        Unblock
                      </Button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Reports you sent ({reports.length})</h2>
        {reports.length === 0 ? (
          <EmptyState title="No reports" body="If someone no-shows, scams you, or asks you to do their graded work, report them from the job or conversation." />
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {report.subject.displayName}
                        <span className="font-normal text-ink-soft"> · {REPORT_KIND_LABELS[report.kind]}</span>
                      </p>
                      {report.job ? (
                        <p className="truncate text-xs text-ink-soft">about “{report.job.request.title}”</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={report.status === "OPEN" ? "warn" : report.status === "UPHELD" ? "danger" : "neutral"}>
                        {report.status === "OPEN" ? "In review" : report.status === "UPHELD" ? "Upheld" : "Closed"}
                      </Badge>
                      <p className="mt-1">
                        <RelativeTime date={report.createdAt} />
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
