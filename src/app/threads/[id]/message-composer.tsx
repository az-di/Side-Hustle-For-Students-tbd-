"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { sendMessageAction } from "@/app/actions/marketplace.actions";
import { Button, FormError, Input } from "@/components/ui";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : "Send"}
    </Button>
  );
}

export function MessageComposer({ threadId }: { threadId: string }) {
  const [state, action] = useActionState(sendMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Clear the box and pull in the new message once the send succeeds.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  // Light polling so a conversation feels live during the demo without a
  // websocket: refresh while the tab is focused.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 10_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <div className="flex gap-2">
        <Input name="body" placeholder="Write a message…" autoComplete="off" required maxLength={4000} />
        <SendButton />
      </div>
      <FormError>{state?.error}</FormError>
    </form>
  );
}
