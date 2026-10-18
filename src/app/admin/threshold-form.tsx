"use client";

import { useActionState } from "react";
import { setReportThresholdAction } from "@/app/actions/admin.actions";
import { Button, FormError, Input } from "@/components/ui";

export function ThresholdForm({ current }: { current: number }) {
  const [state, action] = useActionState(setReportThresholdAction, undefined);
  return (
    <form action={action} className="flex items-start gap-2">
      <Input name="threshold" type="number" min={1} max={100} defaultValue={current} className="w-24" required />
      <Button type="submit" variant="secondary">
        Save
      </Button>
      {state?.ok ? <span className="self-center text-sm text-money">Saved.</span> : null}
      <FormError>{state?.error}</FormError>
    </form>
  );
}
