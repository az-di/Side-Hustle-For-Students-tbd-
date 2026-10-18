import { blockUserAction, unblockUserAction } from "@/app/actions/trust.actions";
import { ButtonLink } from "@/components/ui";

/**
 * The "Report · Block" pair that sits on a profile, a thread and a job page.
 * Server component: both actions are plain forms, so it works without JS.
 */
export function SafetyMenu({
  handle,
  blockedByMe,
  jobId,
  canReport,
}: {
  handle: string;
  blockedByMe: boolean;
  jobId?: string | null;
  canReport: boolean;
}) {
  const reportHref = jobId ? `/report/${handle}?job=${jobId}` : `/report/${handle}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
      {canReport ? (
        <ButtonLink href={reportHref} variant="ghost" size="sm" className="!px-2 !py-1 text-xs">
          Report
        </ButtonLink>
      ) : null}
      <form action={blockedByMe ? unblockUserAction : blockUserAction}>
        <input type="hidden" name="handle" value={handle} />
        <button type="submit" className="rounded-control px-2 py-1 text-xs text-ink-soft hover:bg-danger-soft hover:text-danger">
          {blockedByMe ? "Unblock" : "Block"}
        </button>
      </form>
    </div>
  );
}
