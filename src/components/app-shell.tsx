import Link from "next/link";
import type { ReactNode } from "react";
import type { Viewer } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { signOutAction } from "@/app/actions/auth.actions";
import { Avatar, Badge, ButtonLink } from "@/components/ui";
import { DemoSwitcher } from "@/components/demo-switcher";
import { SyncIndicators } from "@/components/sync-indicators";

/**
 * One shell for every page: a top bar on all sizes and a sticky bottom nav on
 * phones, because that is where this gets demoed and used.
 */
export function AppShell({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-brand">
            HUSTL
          </Link>
          {/* The switcher already signals demo mode; on a phone this badge only
              costs header room and pushes Sign out off the edge. */}
          {isDemoMode ? (
            <span className="hidden sm:inline">
              <Badge tone="warn">demo</Badge>
            </span>
          ) : null}

          <div className="flex-1" />

          {viewer ? (
            <>
              <DemoSwitcher currentHandle={viewer.handle} />
              <SyncIndicators />
              <Link
                href={`/sellers/${viewer.handle}`}
                className="flex items-center gap-2 rounded-full p-0.5 hover:bg-brand-soft"
                title={viewer.uwEmail}
              >
                <Avatar name={viewer.displayName} size={32} />
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="shrink-0 text-xs text-ink-faint underline hover:text-ink-soft"
                  title="Sign out"
                >
                  <span className="hidden sm:inline">Sign out</span>
                  <span aria-hidden className="sm:hidden">
                    ⏻
                  </span>
                  <span className="sr-only sm:hidden">Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href="/login" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>
      </header>

      {viewer?.status === "SUSPENDED" ? (
        <div className="border-b border-danger/20 bg-danger-soft">
          <p className="mx-auto max-w-3xl px-4 py-2 text-xs text-danger">
            <strong>Your account is suspended.</strong> You can read your messages and jobs, but you cannot post, respond
            or message until it is reviewed. Email the HUSTL team if you think this is a mistake.
          </p>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24 sm:pb-8">{children}</div>

      {viewer ? (
        <footer className="mx-auto w-full max-w-3xl px-4 pb-24 text-xs text-ink-faint sm:pb-6">
          <Link href="/settings/safety" className="underline hover:text-ink-soft">
            Blocked people and reports
          </Link>
          {" · "}
          <Link href="/settings/email" className="underline hover:text-ink-soft">
            Email
          </Link>
          {" · "}
          <Link href="/settings/watched-tags" className="underline hover:text-ink-soft">
            Watched tags
          </Link>
          {viewer.isAdmin ? (
            <>
              {" · "}
              <Link href="/admin/reports" className="underline hover:text-ink-soft">
                Admin: report queue
              </Link>
            </>
          ) : null}
        </footer>
      ) : null}

      {viewer ? <BottomNav isSeller={viewer.isSeller} /> : null}
    </div>
  );
}

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/search", label: "Find", icon: "⌕" },
  { href: "/requests", label: "Requests", icon: "✎" },
  { href: "/threads", label: "Messages", icon: "✉" },
];

function BottomNav({ isSeller }: { isSeller: boolean }) {
  const items = isSeller ? [...NAV, { href: "/settings/seller", label: "Selling", icon: "★" }] : NAV;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-3xl">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-ink-soft hover:text-brand"
          >
            <span aria-hidden className="text-base leading-none">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
