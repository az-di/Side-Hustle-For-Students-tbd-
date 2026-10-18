import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listReportsForAdmin } from "@/modules/trust/queries";
import { REPORT_KIND_LABELS } from "@/modules/trust/state";
import { SETTING_KEYS, getNumberSetting } from "@/modules/trust/settings";
import { resolveReportAction, setUserStatusAction } from "@/app/actions/admin.actions";
import { Badge, Button, Card, EmptyState, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Reports · Admin · HUSTL" };

/**
 * The report queue. Admins only (the /admin layout gates; the module logs).
 *
 * Reports with status OPEN count towards suspension already, so the queue is
 * not a gate on safety — it is where a person decides whether a report stands.
 * Dismissing enough of them reinstates an auto-suspended account; a status set
 * by hand here is never auto-reverted.
 */
export default async function AdminReportsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [reports, threshold] = await Promise.all([
    listReportsForAdmin(),
    getNumberSetting(SETTING_KEYS.reportSuspendThreshold),
  ]);
  const open = reports.filter((r) => r.status === "OPEN");
  const resolved = reports.filter((r) => r.status !== "OPEN");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Report queue"
        subtitle={`Accounts are auto-suspended at a weighted total of ${threshold} — change it on the Overview tab.`}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Open ({open.length})</h2>
        {open.length === 0 ? (
          <EmptyState title="Queue is empty" />
        ) : (
          <ul className="space-y-3">
            {open.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recently resolved</h2>
          <ul className="space-y-3">
            {resolved.slice(0, 30).map((report) => (
              <li key={report.id}>
                <ReportCard report={report} viewerId={viewer.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function ReportCard({
  report,
  viewerId,
}: {
  report: Awaited<ReturnType<typeof listReportsForAdmin>>[number];
  viewerId: string;
}) {
  const subject = report.subject;
  const standing = subject.trust?.negativeReportCount ?? 0;

  return (
    <Card className={report.status === "OPEN" ? "border-warn/30" : "opacity-80"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            <Link href={`/sellers/${subject.handle}`} className="font-medium hover:underline">
              {subject.displayName}
            </Link>
            <span className="text-ink-soft"> reported by </span>
            <Link href={`/sellers/${report.reporter.handle}`} className="font-medium hover:underline">
              {report.reporter.displayName}
            </Link>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <Badge tone="danger">{REPORT_KIND_LABELS[report.kind]}</Badge>
            <span>weight {report.weight}</span>
            {report.job ? (
              <Link href={`/jobs/${report.job.id}`} className="underline">
                {report.job.request.title}
              </Link>
            ) : (
              <span>general</span>
            )}
            <RelativeTime date={report.createdAt} />
          </p>
        </div>
        <div className="text-right text-xs">
          <Badge tone={subject.status === "ACTIVE" ? "neutral" : "danger"}>
            {subject.status.toLowerCase()}
            {subject.trust?.autoSuspendedAt ? " (auto)" : ""}
          </Badge>
          <p className="mt-1 text-ink-faint">standing {standing}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-canvas p-3 text-sm">{report.reason}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {report.status === "OPEN" ? (
          <>
            <form action={resolveReportAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="outcome" value="UPHELD" />
              <Button type="submit" size="sm" variant="danger">
                Uphold
              </Button>
            </form>
            <form action={resolveReportAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="outcome" value="DISMISSED" />
              <Button type="submit" size="sm" variant="secondary">
                Dismiss
              </Button>
            </form>
          </>
        ) : (
          <Badge tone={report.status === "UPHELD" ? "danger" : "neutral"}>{report.status.toLowerCase()}</Badge>
        )}

        <span className="flex-1" />

        {subject.id !== viewerId ? (
          <form action={setUserStatusAction} className="flex items-center gap-1">
            <input type="hidden" name="userId" value={subject.id} />
            {subject.status !== "ACTIVE" ? (
              <Button type="submit" name="status" value="ACTIVE" size="sm" variant="ghost">
                Reinstate
              </Button>
            ) : (
              <Button type="submit" name="status" value="SUSPENDED" size="sm" variant="ghost">
                Suspend
              </Button>
            )}
            {subject.status !== "CLOSED" ? (
              <Button type="submit" name="status" value="CLOSED" size="sm" variant="ghost">
                Close account
              </Button>
            ) : null}
          </form>
        ) : null}
      </div>
    </Card>
  );
}
