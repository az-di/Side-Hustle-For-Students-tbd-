"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/search", label: "Find", icon: FindIcon },
  { href: "/requests", label: "Requests", icon: RequestIcon },
  { href: "/threads", label: "Messages", icon: MessageIcon },
];

function items(isSeller: boolean) {
  return isSeller ? [...NAV, { href: "/settings/seller", label: "Selling", icon: SellIcon }] : NAV;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ isSeller }: { isSeller: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {items(isSeller)
        .filter((item) => item.href !== "/")
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "rounded-control px-2.5 py-1.5 text-sm",
              isActive(pathname, item.href) ? "bg-brand-soft font-medium text-brand-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
    </nav>
  );
}

export function BottomNav({ isSeller }: { isSeller: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-5xl">
        {items(isSeller).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
                active ? "text-brand-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              <item.icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "stroke-brand" : "stroke-current"}>
      <path d="M4 10.5 12 4l8 6.5V20H4z" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function FindIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "stroke-brand" : "stroke-current"}>
      <circle cx="11" cy="11" r="6.25" strokeWidth="1.75" />
      <path d="m16 16 4 4" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function RequestIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "stroke-brand" : "stroke-current"}>
      <path d="M6 4h9l3 3v13H6z" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 16h5" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "stroke-brand" : "stroke-current"}>
      <path d="M4 6h16v10H8l-4 3z" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function SellIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "stroke-brand" : "stroke-current"}>
      <path d="m12 3 2.1 6.3H21l-5.4 3.9 2.1 6.3L12 15.6 6.3 19.5l2.1-6.3L3 9.3h6.9z" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
