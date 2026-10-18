"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmCompleteAction,
  markCompleteAction,
  reviewAction,
} from "@/app/actions/marketplace.actions";
import { Button, FormError, Textarea } from "@/components/ui";

function Submit({ label, busy, variant }: { label: string; busy: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function MarkCompleteButton({ jobId }: { jobId: string }) {
  const [state, action] = useActionState(markCompleteAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Submit label="Mark complete" busy="Marking…" />
      <FormError>{state?.error}</FormError>
    </form>
  );
}

export function ConfirmCompleteButton({ jobId }: { jobId: string }) {
  const [state, action] = useActionState(confirmCompleteAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Submit label="Confirm it's done" busy="Confirming…" />
      <FormError>{state?.error}</FormError>
    </form>
  );
}

export function ReviewForm({ jobId, sellerName }: { jobId: string; sellerName: string }) {
  const [state, action] = useActionState(reviewAction, undefined);
  const [rating, setRating] = useState(5);

  if (state?.ok) {
    return (
      <p className="rounded-card border border-money/20 bg-money-soft p-3 text-sm text-money">
        Thanks — your review is on {sellerName}&rsquo;s profile.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <span className="mb-1.5 block text-sm font-medium">How did it go?</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              className={
                n <= rating
                  ? "text-3xl leading-none text-warn"
                  : "text-3xl leading-none text-line hover:text-warn/50"
              }
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <Textarea
        name="body"
        maxLength={1000}
        placeholder={`What should other students know about working with ${sellerName}?`}
      />

      <FormError>{state?.error}</FormError>
      <Submit label="Leave review" busy="Posting…" />
    </form>
  );
}
