"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reportUserAction } from "@/app/actions/trust.actions";
import { Button, Field, FormError, Select, Textarea } from "@/components/ui";

/** Mirrors REPORT_KIND_LABELS in modules/trust/state.ts; duplicated to keep this a client file. */
const KINDS = [
  ["NO_SHOW", "Did not show up or deliver"],
  ["ABUSIVE", "Abusive or harassing"],
  ["SCAM", "Scam or payment fraud"],
  ["ACADEMIC_DISHONESTY", "Asked for graded work to be done for them"],
  ["OFF_PLATFORM_PRESSURE", "Pressured to go off-platform"],
  ["SPAM", "Spam"],
  ["OTHER", "Something else"],
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Sending…" : "Send report"}
    </Button>
  );
}

export function ReportForm({
  handle,
  subjectName,
  jobId,
  alreadyBlocked,
}: {
  handle: string;
  subjectName: string;
  jobId: string | null;
  alreadyBlocked: boolean;
}) {
  const [state, action] = useActionState(reportUserAction, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-card border border-money/20 bg-money-soft p-3 text-money">
          Thanks. Your report is in the queue and will be read by a person. {subjectName} is not told who reported
          them.
        </p>
        <Link href="/settings/safety" className="text-brand underline">
          See your reports and blocks
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="handle" value={handle} />
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}

      <Field label="What happened?">
        <Select name="kind" defaultValue="NO_SHOW" required>
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Details" hint="What you write here is seen only by whoever reviews the report.">
        <Textarea name="reason" minLength={10} maxLength={2000} required placeholder="Be specific — dates, what was agreed, what happened instead." />
      </Field>

      {!alreadyBlocked ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="block" defaultChecked className="mt-1" />
          <span>
            Also block {subjectName}. They will not be able to message you or see your requests, and you will not see
            theirs. You can undo this in Settings.
          </span>
        </label>
      ) : null}

      <FormError>{state?.error}</FormError>
      <Submit />
    </form>
  );
}
