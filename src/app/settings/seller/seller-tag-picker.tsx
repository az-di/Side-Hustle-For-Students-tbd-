"use client";

import { useTransition } from "react";
import { toggleSellerTagAction } from "@/app/actions/marketplace.actions";
import { TagSearchBox } from "@/components/tag-search-box";
import { Badge } from "@/components/ui";

type Tag = { id: string; name: string; slug: string; kind: "SERVICE" | "COURSE" };

export function SellerTagPicker({ current }: { current: Tag[] }) {
  const [pending, startTransition] = useTransition();

  function toggle(tagId: string, on: boolean) {
    const formData = new FormData();
    formData.set("tagId", tagId);
    formData.set("on", String(on));
    startTransition(() => {
      void toggleSellerTagAction(formData);
    });
  }

  return (
    <div className={pending ? "opacity-60" : undefined}>
      {current.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {current.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id, false)}
              className="group"
              aria-label={`Remove ${tag.name}`}
            >
              <Badge tone={tag.kind === "COURSE" ? "neutral" : "brand"}>
                {tag.name}
                <span aria-hidden className="ml-0.5 text-ink-faint group-hover:text-danger">
                  ×
                </span>
              </Badge>
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-ink-soft">
          No tags yet — without one, nobody can find you and you get no requests.
        </p>
      )}

      <TagSearchBox
        placeholder="Add a tag you can do work in…"
        onPick={(tag) => {
          if (!current.some((t) => t.id === tag.id)) toggle(tag.id, true);
        }}
      />
    </div>
  );
}
