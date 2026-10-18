import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { listUsersForAdmin } from "@/modules/admin/queries";
import { setUserAdminAction, setUserStatusAction } from "@/app/actions/admin.actions";
import { Avatar, Badge, Button, Card, Input, PageHeader, RelativeTime } from "@/components/ui";

export const metadata = { title: "Users · Admin · HUSTL" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, viewer] = await Promise.all([searchParams, getViewer()]);
  const users = await listUsersForAdmin({ q });

  return (
    <main className="space-y-5">
      <PageHeader title="Users" subtitle="Search by handle, name or email. Standing is the weighted total of open and upheld reports." />

      <form className="flex gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="mayachen, Maya, maya@uw.edu…" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <ul className="space-y-2">
        {users.map((user) => {
          const isMe = user.id === viewer?.id;
          return (
            <li key={user.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={user.displayName} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/sellers/${user.handle}`} className="font-medium hover:underline">
                        {user.displayName}
                      </Link>
                      <span className="text-xs text-ink-faint">@{user.handle}</span>
                      {user.isAdmin ? <Badge tone="brand">admin</Badge> : null}
                      {user.isDemo ? <Badge tone="warn">demo</Badge> : null}
                      <Badge tone={user.status === "ACTIVE" ? "neutral" : "danger"}>
                        {user.status.toLowerCase()}
                        {user.trust?.autoSuspendedAt ? " (auto)" : ""}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {user.uwEmail} · joined <RelativeTime date={user.createdAt} /> · {user._count.buyerRequests} request
                      {user._count.buyerRequests === 1 ? "" : "s"}
                      {user.sellerProfile
                        ? ` · seller${user.sellerProfile.isAvailable ? "" : " (paused)"}, ${user.sellerProfile.completedJobCount} done`
                        : ""}
                      {" · "}
                      standing {user.trust?.negativeReportCount ?? 0} ({user._count.reportsAgainst} report
                      {user._count.reportsAgainst === 1 ? "" : "s"})
                    </p>
                  </div>

                  {!isMe ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <form action={setUserStatusAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        {user.status === "ACTIVE" ? (
                          <Button type="submit" name="status" value="SUSPENDED" size="sm" variant="ghost">
                            Suspend
                          </Button>
                        ) : (
                          <Button type="submit" name="status" value="ACTIVE" size="sm" variant="ghost">
                            Reinstate
                          </Button>
                        )}
                        {user.status !== "CLOSED" ? (
                          <Button type="submit" name="status" value="CLOSED" size="sm" variant="ghost">
                            Close
                          </Button>
                        ) : null}
                      </form>
                      <form action={setUserAdminAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="isAdmin" value={user.isAdmin ? "false" : "true"} />
                        <Button type="submit" size="sm" variant="ghost">
                          {user.isAdmin ? "Remove admin" : "Make admin"}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-faint">you</span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
