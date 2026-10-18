import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getEmailSettings, listRecentEmails } from "@/modules/email/queries";
import { setEmailOptOutAction } from "@/app/actions/settings.actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Email · HUSTL" };

export default async function EmailSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [me, recent] = await Promise.all([getEmailSettings(viewer.id), listRecentEmails(viewer.id)]);

  return (
    <main className="space-y-6">
      <PageHeader title="Email" subtitle={`Sent to ${me.uwEmail}. Sign-in codes are always sent.`} />

      <Card className={me.emailOptOut ? "border-warn/30 bg-warn-soft" : undefined}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{me.emailOptOut ? "Email is off" : "Email is on"}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {me.emailOptOut
                ? "You only see notifications inside the app."
                : "Direct requests, responses, job updates and reviews email you right away. New open requests in your tags are bundled into at most one email a day."}
            </p>
          </div>
          <form action={setEmailOptOutAction}>
            <input type="hidden" name="optOut" value={me.emailOptOut ? "false" : "true"} />
            <Button type="submit" variant="secondary" size="sm">
              {me.emailOptOut ? "Turn on" : "Turn off"}
            </Button>
          </form>
        </div>
      </Card>

      {recent.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent</h2>
          <ul className="space-y-1.5 text-xs">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className="text-ink-soft">
                  {row.template === "digest" ? "Daily digest of open requests" : "Notification"}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={row.status === "SENT" ? "money" : row.status === "PENDING" ? "brand" : "neutral"}>
                    {row.status.toLowerCase()}
                  </Badge>
                  <span className="text-ink-faint">{(row.sentAt ?? row.createdAt).toLocaleString()}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
