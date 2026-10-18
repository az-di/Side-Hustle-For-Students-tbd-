"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { uploadPortfolioAction } from "@/app/actions/media.actions";
import { Button, Field, FormError, Input } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

export function PortfolioUploader({ maxFileLabel }: { maxFileLabel: string }) {
  const [state, action] = useActionState(uploadPortfolioAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful upload so the next pick starts fresh.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Field label="Add a photo, video or PDF" hint={`Up to ${maxFileLabel}. JPG, PNG, GIF, WebP, MP4, MOV, WebM or PDF.`}>
        <Input type="file" name="file" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" required />
      </Field>
      <Field label="Caption (optional)">
        <Input name="caption" maxLength={140} placeholder="Grad photos, Rainier Vista, May" />
      </Field>
      <FormError>{state?.error}</FormError>
      <Submit />
    </form>
  );
}
