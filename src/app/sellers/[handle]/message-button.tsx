"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { openInquiryAction } from "@/app/actions/marketplace.actions";
import { Button, FormError } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Opening…" : "Message"}
    </Button>
  );
}

/** Opens the viewer's inquiry thread with this seller (one per pair, rate-limited). */
export function MessageButton({ handle }: { handle: string }) {
  const [state, action] = useActionState(openInquiryAction, undefined);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="handle" value={handle} />
      <Submit />
      <FormError>{state?.error}</FormError>
    </form>
  );
}
