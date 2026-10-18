"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveListingAction } from "@/app/actions/marketplace.actions";
import { TagSearchBox } from "@/components/tag-search-box";
import { Badge, Button, Field, FormError, Input, Textarea } from "@/components/ui";

type Tag = { id: string; name: string; slug: string; kind: "SERVICE" | "COURSE" };

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Publish service"}
    </Button>
  );
}

export function ListingForm() {
  const [state, action] = useActionState(saveListingAction, undefined);
  const [tags, setTags] = useState<Tag[]>([]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tagIds" value={tags.map((t) => t.id).join(",")} />

      <Field label="Title">
        <Input name="title" required maxLength={140} placeholder="Grad photo session (1 hour, 25 edited photos)" />
      </Field>

      <Field label="What the buyer gets">
        <Textarea
          name="description"
          required
          maxLength={4000}
          placeholder="One hour around campus, 25 edited photos within 3 days, plus the raw frames if you want them."
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Flat price" hint="For about an hour of work, keep this near your hourly rate.">
          <Input name="fixed" inputMode="decimal" placeholder="40" />
        </Field>
        <Field label="Hourly">
          <Input name="hourly" inputMode="decimal" placeholder="40" />
        </Field>
        <Field label="Turnaround">
          <Input name="turnaroundDays" inputMode="numeric" placeholder="3 days" />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Tags</span>
        {tags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTags((c) => c.filter((t) => t.id !== tag.id))}
                aria-label={`Remove ${tag.name}`}
                className="group"
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
        ) : null}
        <TagSearchBox
          placeholder="Which tags does this fall under?"
          onPick={(tag) => setTags((c) => (c.some((t) => t.id === tag.id) ? c : [...c, tag]))}
        />
        <span className="mt-1.5 block text-xs text-ink-soft">
          Publishing under a tag also marks you open to it.
        </span>
      </div>

      <FormError>{state?.error}</FormError>
      {state?.ok ? <p className="text-sm text-money">Published. Reload to see it in the list above.</p> : null}
      <Save />
    </form>
  );
}
