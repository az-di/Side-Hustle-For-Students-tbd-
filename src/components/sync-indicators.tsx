"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Sync = { unreadNotifications: number; unreadThreads: number };

/**
 * The notification + message badges.
 *
 * Polls /api/sync every 20s rather than holding a websocket: no persistent
 * connection infrastructure, and entirely adequate at campus scale. Pauses
 * while the tab is hidden and refetches the moment it regains focus, which is
 * what makes the demo feel live when you switch between two browser windows.
 *
 * Also refetches on navigation. Opening a thread marks it read on the server,
 * but this component stays mounted in the header, so without a pathname
 * change the badge would keep the old count until the next 20s tick.
 */
export function SyncIndicators() {
  const pathname = usePathname();
  const [sync, setSync] = useState<Sync>({ unreadNotifications: 0, unreadThreads: 0 });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/sync", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Sync;
        if (!cancelled) setSync(data);
      } catch {
        // Offline or mid-deploy: keep the last known counts rather than
        // flashing zeros at the user.
      }
    }

    // Defer the first read so setState runs from a timer callback, not the
    // effect body. The effect restarts on navigation, which is the refresh.
    const kick = setTimeout(poll, 0);
    const timer = setInterval(poll, 20_000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(kick);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pathname]);

  return (
    <div className="flex items-center gap-1">
      <IndicatorLink
        href="/threads"
        count={sync.unreadThreads}
        icon="✉"
        label="unread conversations"
      />
      <IndicatorLink
        href="/notifications"
        count={sync.unreadNotifications}
        icon="🔔"
        label="unread notifications"
      />
    </div>
  );
}

function IndicatorLink({
  href,
  count,
  icon,
  label,
}: {
  href: string;
  count: number;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-base hover:bg-brand-soft"
      aria-label={count > 0 ? `${count} ${label}` : label}
    >
      <span aria-hidden>{icon}</span>
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
