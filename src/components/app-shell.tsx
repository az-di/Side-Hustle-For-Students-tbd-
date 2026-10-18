import Link from "next/link";
import type { ReactNode } from "react";
import type { Viewer } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { signOutAction } from "@/app/actions/auth.actions";
import { Avatar, Badge, ButtonLink, Wordmark } from "@/components/ui";
import { DemoSwitcher } from "@/components/demo-switcher";
import { SyncIndicators } from "@/components/sync-indicators";
import { BottomNav, DesktopNav } from "@/components/main-nav";

/**
 * One shell for every page: a top bar on all sizes and a sticky bottom nav on
 * phones, because that is where this gets demoed and used.
 */
export function AppShell({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="site-header sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="shrink-0">
            <Wordmark />
          </Link>
          {isDemoMode ? (
            <span className="hidden sm:inline">
              <Badge tone="warn">demo</Badge>
            </span>
          ) : null}

          {viewer ? <DesktopNav isSeller={viewer.isSeller} /> : null}

          <div className="flex-1" />

          {viewer ? (
            <>
              <DemoSwitcher currentHandle={viewer.handle} />
              <SyncIndicators />
              <Link
                href={`/sellers/${viewer.handle}`}
                className="flex items-center gap-2 rounded-control p-0.5 hover:bg-brand-soft"
                title={viewer.uwEmail}
              >
                <Avatar name={viewer.displayName} size={32} />
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="shrink-0 text-xs text-ink-faint underline hover:text-ink-soft"
                >
                  Sign out
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
          <p className="mx-auto max-w-5xl px-4 py-2 text-xs text-danger">
            <strong>Your account is suspended.</strong> You can read your messages and jobs, but you cannot post, respond
            or message until it is reviewed. Email the HUSTL team if you think this is a mistake.
          </p>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 sm:pb-8">{children}</div>

      <footer className="site-footer mx-auto flex w-full max-w-5xl flex-wrap gap-x-5 gap-y-1 px-4 pb-24 text-xs text-ink-faint sm:pb-6">
        <Link href="/terms" className="underline hover:text-ink-soft">
          Terms
        </Link>
        <Link href="/privacy" className="underline hover:text-ink-soft">
          Privacy
        </Link>
        {viewer ? (
          <>
            <Link href="/settings/safety" className="underline hover:text-ink-soft">
              Blocked people and reports
            </Link>
            <Link href="/settings/email" className="underline hover:text-ink-soft">
              Email
            </Link>
            <Link href="/settings/watched-tags" className="underline hover:text-ink-soft">
              Watched tags
            </Link>
            {viewer.isAdmin ? (
              <Link href="/admin" className="underline hover:text-ink-soft">
                Admin
              </Link>
            ) : null}
          </>
        ) : null}
      </footer>

      {viewer ? <BottomNav isSeller={viewer.isSeller} /> : null}
    </div>
  );
}
