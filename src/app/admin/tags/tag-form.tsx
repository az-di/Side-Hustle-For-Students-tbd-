"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTagAction, updateTagAction } from "@/app/actions/admin.actions";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function TagForm({
  tag,
}: {
  tag?: { id: string; name: string; kind: "SERVICE" | "COURSE"; synonyms: string[]; sortOrder: number };
}) {
  const [state, action] = useActionState(tag ? updateTagAction : createTagAction, undefined);

  return (
    <form action={action} className="space-y-3">
      {tag ? <input type="hidden" name="tagId" value={tag.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Name">
          <Input name="name" defaultValue={tag?.name ?? ""} required maxLength={60} placeholder="Photography or MATH 124" />
        </Field>
        <Field label="Kind">
          <Select name="kind" defaultValue={tag?.kind ?? "SERVICE"}>
            <option value="SERVICE">Service</option>
            <option value="COURSE">Course</option>
          </Select>
        </Field>
        <Field label="Sort">
          <Input name="sortOrder" type="number" defaultValue={tag?.sortOrder ?? 200} className="w-24" />
        </Field>
      </div>
      <Field label="Hidden synonyms" hint="One per line or comma-separated. Matched by search, never shown.">
        <Textarea name="synonyms" defaultValue={tag?.synonyms.join("\n") ?? ""} placeholder={"photoshoot\nheadshots\ngrad photos"} />
      </Field>
      <FormError>{state?.error}</FormError>
      <div className="flex items-center gap-3">
        <Save label={tag ? "Save" : "Create tag"} />
        {state?.ok ? <span className="text-sm text-money">Saved.</span> : null}
      </div>
    </form>
  );
}
