import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getReportContext } from "@/modules/trust/queries";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ReportForm } from "./report-form";

export const metadata = { title: "Report · HUSTL" };

/**
 * One report form, reachable from a profile, a thread or a job. Reports are
 * only accepted about someone the viewer has actually dealt with, which the
 * form explains rather than silently failing.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const [{ handle }, { job: jobId }, viewer] = await Promise.all([params, searchParams, getViewer()]);
  if (!viewer) redirect("/login");

  const context = await getReportContext({ viewerId: viewer.id, handle, jobId });
  if (!context) notFound();
  const { subject, relationship, jobTitle } = context;

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader
        title={`Report ${subject.displayName}`}
        subtitle={jobTitle ? `About the job “${jobTitle}”` : "Tell us what happened. Reports are read by a person."}
      />

      {!relationship.canReport ? (
        <EmptyState
          title="You can report someone once you have dealt with them"
          body="Reports are tied to a request or a job so that nobody can pile onto a profile they have never interacted with. If you have, open the thread or job and report from there."
        />
      ) : (
        <Card>
          <ReportForm
            handle={handle}
            subjectName={subject.displayName}
            jobId={jobTitle ? (jobId ?? null) : null}
            alreadyBlocked={relationship.blockedByMe}
          />
        </Card>
      )}
    </main>
  );
}
