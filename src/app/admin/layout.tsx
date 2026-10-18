import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth";

/**
 * Gate and sub-nav for everything under /admin. Non-admins get a 404, not a
 * 403: the console's existence is not advertised. Writes are guarded again
 * inside modules/admin/audit.ts, so this is UX, not the security boundary.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) notFound();

  return (
    <div>
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line pb-3 text-sm">
        {[
          ["/admin", "Overview"],
          ["/admin/reports", "Reports"],
          ["/admin/tags", "Tags"],
          ["/admin/users", "Users"],
          ["/admin/audit", "Audit log"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-control px-3 py-1 text-ink-soft hover:bg-brand-soft hover:text-brand-ink">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
