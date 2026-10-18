import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getThreadForViewer } from "@/modules/messaging/queries";
import { markThreadRead } from "@/modules/messaging/mutations";
import { Avatar, ButtonLink, Card } from "@/components/ui";
import { MessageComposer } from "./message-composer";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  let thread;
  try {
    thread = await getThreadForViewer(id, viewer.id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  // Opening the conversation is reading it.
  await markThreadRead({ threadId: id, userId: viewer.id });

  return (
    <main className="flex min-h-[70dvh] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={thread.counterparty.displayName} />
        <div className="min-w-0 flex-1">
          <Link href={`/sellers/${thread.counterparty.handle}`} className="font-medium hover:underline">
            {thread.counterparty.displayName}
          </Link>
          <p className="truncate text-xs text-ink-soft">{thread.title}</p>
        </div>
        {thread.jobId ? (
          <ButtonLink href={`/jobs/${thread.jobId}`} size="sm" variant="secondary">
            Job
          </ButtonLink>
        ) : thread.requestId ? (
          <ButtonLink href={`/requests/${thread.requestId}`} size="sm" variant="secondary">
            Request
          </ButtonLink>
        ) : null}
      </div>

      <ol className="flex-1 space-y-2">
        {thread.messages.map((message) =>
          message.isSystem ? (
            <li key={message.id} className="py-1 text-center">
              {/*
                System messages are read by BOTH parties, which makes this a
                seller-facing surface — so they never contain a money figure.
              */}
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-faint">{message.body}</span>
            </li>
          ) : (
            <li key={message.id} className={message.isMine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.isMine
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className={message.isMine ? "mt-0.5 text-[10px] text-white/70" : "mt-0.5 text-[10px] text-ink-faint"}>
                  {message.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </li>
          ),
        )}
      </ol>

      <div className="sticky bottom-16 mt-4 sm:bottom-0">
        {thread.isClosed ? (
          <Card className="text-center text-sm text-ink-soft">
            This conversation is closed — the buyer went with someone else.
          </Card>
        ) : (
          <MessageComposer threadId={thread.id} />
        )}
      </div>
    </main>
  );
}
