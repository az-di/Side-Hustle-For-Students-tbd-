"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createRequestAction } from "@/app/actions/marketplace.actions";
import { TagSearchBox } from "@/components/tag-search-box";
import { Badge, Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";

type TagHit = { id: string; name: string; kind: "SERVICE" | "COURSE"; slug: string };

const FEE_BPS = 1000;
const MAX_TAGS = 3;

/** Mirrors netFromGross in src/lib/money.ts, for the live preview. */
function netFromGross(cents: number): number {
  return Math.floor((cents * (10_000 - FEE_BPS)) / 10_000);
}

function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function money(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Posting…" : label}
    </Button>
  );
}

export function RequestForm({
  initialTags,
  target,
  listingId,
}: {
  initialTags: TagHit[];
  target: { userId: string; displayName: string } | null;
  listingId?: string;
}) {
  const [state, action] = useActionState(createRequestAction, undefined);
  const [tags, setTags] = useState<TagHit[]>(initialTags);
  const [fixed, setFixed] = useState("");
  const [hourly, setHourly] = useState("");

  const fixedCents = parseDollars(fixed);
  const hourlyCents = parseDollars(hourly);

  function addTag(tag: TagHit) {
    setTags((current) =>
      current.some((t) => t.id === tag.id) || current.length >= MAX_TAGS ? current : [...current, tag],
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={target ? "DIRECT" : "OPEN"} />
      {target ? <input type="hidden" name="targetSellerUserId" value={target.userId} /> : null}
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      <input type="hidden" name="tagIds" value={tags.map((t) => t.id).join(",")} />

      <Field label="What do you need?">
        <Input name="title" placeholder="Photographer for our winter banquet" required maxLength={140} />
      </Field>

      <Field label="Details" hint="When, where, how long, and anything that would change the price.">
        <Textarea
          name="details"
          required
          maxLength={4000}
          placeholder="Climbing club banquet at the HUB, Feb 7, about 2 hours, 60 people. Need candids plus one group shot."
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          Tags <span className="font-normal text-ink-faint">(up to {MAX_TAGS})</span>
        </span>
        {tags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTags((c) => c.filter((t) => t.id !== tag.id))}
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
        ) : null}
        {tags.length < MAX_TAGS ? (
          <TagSearchBox placeholder="Add a tag — “photoshoot”, “logo”, “MATH 124”…" onPick={addTag} />
        ) : null}
        <span className="mt-1.5 block text-xs text-ink-soft">
          {target
            ? "Tags help us keep your request organised."
            : "Every seller open to these tags is notified."}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Flat budget">
          <Input
            name="fixed"
            inputMode="decimal"
            placeholder="$100"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
          />
        </Field>
        <Field label="Or hourly">
          <Input
            name="hourly"
            inputMode="decimal"
            placeholder="$25/hr"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
          />
        </Field>
      </div>

      {/*
        The money boundary, made explicit to the buyer before they post.
        They set a ceiling; the seller is only ever shown the payout.
      */}
      {fixedCents || hourlyCents ? (
        <div className="rounded-card border border-money/20 bg-money-soft p-3 text-sm">
          <p className="font-medium text-money">
            Your seller will see{" "}
            {fixedCents ? money(netFromGross(fixedCents)) : null}
            {fixedCents && hourlyCents ? " / " : null}
            {hourlyCents ? `${money(netFromGross(hourlyCents))}/hr` : null}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            HUSTL takes 10%, which is <strong>waived in beta</strong> — so pay your seller that amount directly
            over Venmo. They never see your maximum, which is what keeps people from taking the deal off HUSTL.
          </p>
        </div>
      ) : null}

      <Field label="Close this request after">
        <Select name="ttlHours" defaultValue="72">
          <option value="24">24 hours</option>
          <option value="72">3 days</option>
          <option value="168">1 week</option>
          <option value="336">2 weeks</option>
        </Select>
      </Field>

      <FormError>{state?.error}</FormError>
      <Submit label={target ? `Send to ${target.displayName}` : "Post to everyone with these tags"} />
    </form>
  );
}
