import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { demoSignInAction } from "@/app/actions/auth.actions";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · HUSTL" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");

  const personas = isDemoMode
    ? await db.user.findMany({
        where: { isDemo: true },
        select: {
          handle: true,
          displayName: true,
          uwEmail: true,
          sellerProfile: { select: { headline: true, isAvailable: true } },
        },
        orderBy: [{ sellerProfile: { userId: "asc" } }, { displayName: "asc" }],
        take: 12,
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-2xl font-bold tracking-tight text-brand">HUSTL</p>
        <h1 className="mt-4 text-xl font-semibold">Hire other UW students</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Photography, design, video, tutoring and more — from students on your campus.
        </p>
      </div>

      <Card>
        <LoginForm allowedDomain={env.ALLOWED_EMAIL_DOMAIN} />
      </Card>

      <p className="mt-4 text-center text-xs text-ink-faint">
        UW students only. We check that your address ends in @{env.ALLOWED_EMAIL_DOMAIN}.
      </p>

      {personas.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Demo accounts</h2>
            <Badge tone="warn">DEMO_MODE</Badge>
          </div>
          <p className="mb-3 text-xs text-ink-soft">
            Seeded @{env.ALLOWED_EMAIL_DOMAIN} personas, so you can jump between a buyer and a seller without
            waiting on email. Disabled when DEMO_MODE is off.
          </p>
          <div className="space-y-2">
            {personas.map((p) => (
              <form key={p.handle} action={demoSignInAction}>
                <input type="hidden" name="handle" value={p.handle} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-colors hover:border-brand/40"
                >
                  <Avatar name={p.displayName} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.displayName}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {p.sellerProfile?.headline ?? "Buyer account"}
                    </span>
                  </span>
                  {p.sellerProfile && !p.sellerProfile.isAvailable ? <Badge tone="neutral">Paused</Badge> : null}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-center text-xs text-ink-faint">
        <Link href="/" className="underline hover:text-ink-soft">
          Back to browsing
        </Link>
      </p>
    </main>
  );
}
