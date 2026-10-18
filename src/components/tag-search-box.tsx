"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui";

type TagHit = { id: string; name: string; kind: "SERVICE" | "COURSE"; slug: string };

/**
 * Type-ahead over tags, including course codes.
 *
 * Debounced at 150ms and aborts the in-flight request on each keystroke, so
 * fast typing cannot land results out of order.
 *
 * `onPick` makes this reusable: the search page navigates, the request
 * composer collects tags.
 */
export function TagSearchBox({
  placeholder = "Try “photoshoot”, “logo”, or “MATH 124”",
  onPick,
  autoFocus,
}: {
  placeholder?: string;
  onPick?: (tag: TagHit) => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TagHit[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // An empty query is handled in the onChange handler (hits are cleared
    // there), so the effect only ever schedules a fetch.
    if (query.trim().length === 0) return;

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/tags/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { tags: TagHit[] };
        setHits(data.tags);
        setOpen(true);
      } catch {
        // Aborted or offline — leave the previous results in place.
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  function pick(tag: TagHit) {
    setOpen(false);
    setQuery("");
    if (onPick) onPick(tag);
    else router.push(`/search?tag=${tag.slug}`);
  }

  const services = hits.filter((h) => h.kind === "SERVICE");
  const courses = hits.filter((h) => h.kind === "COURSE");

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length === 0) setHits([]);
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="Search for a skill or course"
        role="combobox"
        aria-expanded={open}
        aria-controls="tag-results"
      />

      {open && hits.length > 0 ? (
        <ul
          id="tag-results"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-card border border-line bg-surface py-1 shadow-lg"
        >
          {services.length > 0 ? <Group label="Services" /> : null}
          {services.map((hit) => (
            <Row key={hit.id} hit={hit} onPick={pick} />
          ))}
          {courses.length > 0 ? <Group label="Courses" /> : null}
          {courses.map((hit) => (
            <Row key={hit.id} hit={hit} onPick={pick} />
          ))}
        </ul>
      ) : null}

      {open && query.trim().length > 1 && hits.length === 0 ? (
        <div className="absolute z-30 mt-1 w-full rounded-card border border-line bg-surface px-3 py-3 text-sm text-ink-soft shadow-lg">
          No tags match “{query}”. Try a broader word, like “photo” or “design”.
        </div>
      ) : null}
    </div>
  );
}

function Group({ label }: { label: string }) {
  return (
    <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</li>
  );
}

function Row({ hit, onPick }: { hit: TagHit; onPick: (t: TagHit) => void }) {
  return (
    <li>
      <button
        type="button"
        // onMouseDown, not onClick: the input's onBlur would otherwise close the
        // list before the click lands.
        onMouseDown={(e) => {
          e.preventDefault();
          onPick(hit);
        }}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-soft"
      >
        <span>{hit.name}</span>
        {hit.kind === "COURSE" ? <span className="text-xs text-ink-faint">tutoring</span> : null}
      </button>
    </li>
  );
}
