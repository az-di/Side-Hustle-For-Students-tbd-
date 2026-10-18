import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { env, isDemoMode } from "@/lib/env";
import { listDemoPersonas } from "@/modules/identity/queries";
import { demoSignInAction } from "@/app/actions/auth.actions";
import { Avatar, Badge, Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · HUSTL" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");

  let personas: Awaited<ReturnType<typeof listDemoPersonas>> = [];
  if (isDemoMode) {
    try {
      personas = await listDemoPersonas(12);
    } catch {
      personas = [];
    }
  }

  return (
    <main className="mx-auto w-full max-w-md py-6 sm:py-10">
      <div className="mb-8">
        <p className="text-sm text-verified">UW email required</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Same address you use for Canvas. We check that it ends in @uw.edu.
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
