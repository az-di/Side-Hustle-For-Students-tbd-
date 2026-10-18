import { env, isDemoMode } from "@/lib/env";
import { listDemoPersonas } from "@/modules/identity/queries";
import { demoSignInAction } from "@/app/actions/auth.actions";
import { Avatar, Badge } from "@/components/ui";

/**
 * DEMO_MODE-only persona switcher, in the header.
 *
 * Switching between a buyer and a seller is something you do constantly while
 * building, and twice on stage during the side-by-side reveal. Without this you
 * have to sign out first, which is two extra clicks and a lost page position.
 *
 * Plain <details> plus one form per persona: no client JavaScript, so it cannot
 * break the header if hydration is slow. The action itself refuses to run when
 * DEMO_MODE is off.
 */
export async function DemoSwitcher({ currentHandle }: { currentHandle: string }) {
  if (!isDemoMode) return null;

  const personas = await listDemoPersonas(15);

  if (personas.length === 0) return null;

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-warn/30 bg-warn-soft px-2 py-1 text-xs font-medium text-warn">
        switch
        <span aria-hidden>▾</span>
      </summary>

      <div className="absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-card border border-line bg-surface shadow-lg">
        <p className="border-b border-line px-3 py-2 text-[11px] text-ink-soft">
          Demo personas (@{env.ALLOWED_EMAIL_DOMAIN}). Real sign-in still uses an emailed code.
        </p>
        <ul className="max-h-80 overflow-auto py-1">
          {personas.map((persona) => {
            const isCurrent = persona.handle === currentHandle;
            return (
              <li key={persona.handle}>
                <form action={demoSignInAction}>
                  <input type="hidden" name="handle" value={persona.handle} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-soft disabled:bg-canvas disabled:opacity-60"
                  >
                    <Avatar name={persona.displayName} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{persona.displayName}</span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {persona.sellerProfile?.headline ?? "Buyer account"}
                      </span>
                    </span>
                    {isCurrent ? (
                      <Badge tone="brand">you</Badge>
                    ) : persona.sellerProfile && !persona.sellerProfile.isAvailable ? (
                      <Badge tone="neutral">paused</Badge>
                    ) : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
