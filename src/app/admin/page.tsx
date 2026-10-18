import Link from "next/link";
import { adminOverview } from "@/modules/admin/queries";
import { SETTING_KEYS, getNumberSetting } from "@/modules/trust/settings";
import { Card, PageHeader } from "@/components/ui";
import { ThresholdForm } from "./threshold-form";

export const metadata = { title: "Admin · HUSTL" };

export default async function AdminPage() {
  const [overview, threshold] = await Promise.all([adminOverview(), getNumberSetting(SETTING_KEYS.reportSuspendThreshold)]);

  const tiles = [
    { label: "Accounts", value: overview.users, href: "/admin/users" },
    { label: "Open reports", value: overview.openReports, href: "/admin/reports" },
    { label: "Active tags", value: overview.tags, href: "/admin/tags" },
    { label: "Emails pending", value: overview.pendingEmails, href: "/settings/email" },
  ];

  return (
    <main className="space-y-6">
      <PageHeader title="Admin" subtitle="Every write here is logged to the audit log with who did it." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="hover:border-brand/40">
              <p className="text-xs uppercase tracking-wide text-ink-faint">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold">{tile.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <p className="text-sm font-medium">Auto-suspend threshold</p>
        <p className="mb-3 mt-0.5 text-xs text-ink-soft">
          Weighted report total at which an account is suspended automatically (scam 3, abusive 2, academic 2, the rest
          1). Dismissing reports below the line reinstates an auto-suspension.
        </p>
        <ThresholdForm current={threshold} />
      </Card>

      <p className="text-xs text-ink-faint">
        For anything not here, Prisma Studio (<code>npm run db:studio</code>) is still the escape hatch — but it does
        not write to the audit log.
      </p>
    </main>
  );
}
