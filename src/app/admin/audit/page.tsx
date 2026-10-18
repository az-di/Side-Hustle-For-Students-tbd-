import { listAuditLog } from "@/modules/admin/queries";
import { Card, EmptyState, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Audit log · Admin · HUSTL" };

export default async function AdminAuditPage() {
  const rows = await listAuditLog();

  return (
    <main>
      <PageHeader title="Audit log" subtitle="Every admin write, newest first. Rows are never edited or deleted." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" body="Resolve a report, edit a tag or change an account and it shows up here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{row.admin.displayName}</span>
                    <span className="text-ink-soft"> · </span>
                    <code className="rounded bg-canvas px-1 text-xs">{row.action}</code>
                    <span className="text-ink-soft">
                      {" "}
                      on {row.targetType} <span className="font-mono text-xs">{row.targetId}</span>
                    </span>
                  </p>
                  <RelativeTime date={row.createdAt} />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-canvas p-2 text-xs text-ink-soft">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
