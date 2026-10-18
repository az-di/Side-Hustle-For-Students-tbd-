"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { respondToRequestAction } from "@/app/actions/marketplace.actions";
import { Button, FormError, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send response"}
    </Button>
  );
}

export function RespondForm({ requestId, payoutLabel }: { requestId: string; payoutLabel: string }) {
  const [state, action] = useActionState(respondToRequestAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-card border border-money/20 bg-money-soft p-3 text-sm text-money">
        Response sent. The buyer can now message you and pick someone.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <Textarea
        name="message"
        required
        maxLength={2000}
        placeholder="Tell them how you would do it, what you would deliver and when. Keep it short."
      />
      <p className="text-xs text-ink-soft">
        You are offering to do this for <strong className="text-money">{payoutLabel}</strong>. Price details can be
        worked out in messages.
      </p>
      <FormError>{state?.error}</FormError>
      <Submit />
    </form>
  );
}
