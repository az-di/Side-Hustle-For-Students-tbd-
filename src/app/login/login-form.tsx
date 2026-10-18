"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth.actions";
import { Button, Field, FormError, Input } from "@/components/ui";

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "One moment…" : children}
    </Button>
  );
}

export function LoginForm({ allowedDomain }: { allowedDomain: string }) {
  const [requestState, requestCode] = useActionState(requestCodeAction, undefined);
  const [verifyState, verifyCode] = useActionState(verifyCodeAction, undefined);

  // Step two: a code has been issued for this address.
  if (requestState?.ok && requestState.email) {
    return (
      <form action={verifyCode} className="space-y-4">
        <input type="hidden" name="email" value={requestState.email} />

        <div>
          <p className="text-sm">
            We sent a 6-digit code to <span className="font-medium">{requestState.email}</span>.
          </p>
          {requestState.emailDelivered === false ? (
            <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
              Email is not configured in this environment, so nothing was actually delivered — use the code below.
            </p>
          ) : null}
          {requestState.demoCode ? (
            <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-ink">
              Demo mode code: <span className="font-mono text-base font-semibold">{requestState.demoCode}</span>
            </p>
          ) : null}
        </div>

        <Field label="6-digit code">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            required
            autoFocus
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </Field>

        <FormError>{verifyState?.error}</FormError>
        <SubmitButton>Sign in</SubmitButton>

        <p className="text-center text-xs text-ink-faint">
          Wrong address?{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline hover:text-ink-soft"
          >
            Start over
          </button>
        </p>
      </form>
    );
  }

  // Step one: ask for the UW address.
  return (
    <form action={requestCode} className="space-y-4">
      <Field label="UW email" hint={`Must end in @${allowedDomain}.`}>
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={`you@${allowedDomain}`}
          required
          autoFocus
        />
      </Field>

      <FormError>{requestState?.error}</FormError>
      <SubmitButton>Email me a code</SubmitButton>
    </form>
  );
}
