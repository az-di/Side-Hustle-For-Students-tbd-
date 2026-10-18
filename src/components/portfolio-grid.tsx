import type { ReactNode } from "react";
import type { PortfolioItemDto } from "@/modules/media/queries";

/**
 * The portfolio tiles, shared by the public profile and the seller's own
 * settings page. `actions` renders per tile (a delete button in settings).
 */
export function PortfolioGrid({
  items,
  actions,
}: {
  items: PortfolioItemDto[];
  actions?: (item: PortfolioItemDto) => ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-card border border-line bg-surface">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-canvas">
            {item.kind === "IMAGE" ? (
              // Plain <img>: the files are served by this app, not an image CDN.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
            ) : item.kind === "VIDEO" ? (
              <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
                <span aria-hidden className="text-3xl">
                  ▤
                </span>
                <span className="text-xs">PDF</span>
              </span>
            )}
          </a>
          {item.caption || actions ? (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <p className="truncate text-xs text-ink-soft">{item.caption}</p>
              {actions?.(item)}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
