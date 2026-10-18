"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSellerProfileAction } from "@/app/actions/marketplace.actions";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

export function SellerProfileForm({
  initial,
}: {
  initial: {
    displayName: string;
    bio: string;
    headline: string;
    about: string;
    venmoHandle: string;
    fixed: string;
    hourly: string;
    portfolioLinks: string;
  };
}) {
  const [state, action] = useActionState(saveSellerProfileAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field label="Name">
        <Input name="displayName" defaultValue={initial.displayName} required maxLength={60} />
      </Field>

      <Field label="Headline">
        <Input
          name="headline"
          defaultValue={initial.headline}
          maxLength={120}
          placeholder="Campus photographer — portraits, grad photos, events"
        />
      </Field>

      <Field label="About" hint="What you do, what you have shot or made, how you work.">
        <Textarea name="about" defaultValue={initial.about} maxLength={2000} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Typical flat price" hint="What you take home for about an hour of work.">
          <Input name="fixed" inputMode="decimal" defaultValue={initial.fixed} placeholder="40" />
        </Field>
        <Field label="Hourly rate" hint="What you take home.">
          <Input name="hourly" inputMode="decimal" defaultValue={initial.hourly} placeholder="40" />
        </Field>
      </div>
      {/*
        Seller prices are stored NET on purpose: a seller typing 90 must see 90
        back on their own profile. Buyers' budgets are grossed up from these.
      */}
      <p className="-mt-2 text-xs text-ink-soft">
        These are the amounts you receive. A one-hour job should land near your hourly rate — not almost two hours of
        pay for one hour of work. Buyers see them as-is; HUSTL does not mark up your listing.
      </p>

      <Field
        label="Venmo handle"
        hint="Shown only to someone you have an active job with — never on your public profile."
      >
        <Input name="venmoHandle" defaultValue={initial.venmoHandle} maxLength={40} placeholder="@your-venmo" />
      </Field>

      <Field label="Portfolio links" hint="One per line. Instagram, a site, a SoundCloud — whatever shows your work.">
        <Textarea name="portfolioLinks" defaultValue={initial.portfolioLinks} />
      </Field>

      <Field label="Short bio" hint="Appears if you post requests as a buyer too.">
        <Input name="bio" defaultValue={initial.bio} maxLength={500} />
      </Field>

      <FormError>{state?.error}</FormError>
      {state?.ok ? <p className="text-sm text-money">Saved.</p> : null}
      <Save />
    </form>
  );
}
