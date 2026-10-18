import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import type { Tx } from "@/lib/tx";
import { NOTIFICATION_COPY, notificationHref } from "@/modules/notifications/copy";

/**
 * Email templates.
 *
 * Every template is rendered at SEND time from ids in the outbox payload, for
 * one recipient, so the row never holds a pre-baked string. The props types
 * below are deliberately money-free: the only numbers an email carries are
 * counts. If a template ever needs an amount, it must take role-specific
 * props (a seller template may carry net figures only) and be added to the
 * leak suite — the same rule as the request DTOs.
 */

export type RenderedEmail = { subject: string; text: string; html: string };

export type TemplateName = "notification" | "digest";

export type NotificationProps = { line: string; title: string; href: string };
export type DigestProps = { count: number; titles: string[]; href: string };

// ───────────────────────────── unsubscribe link ────────────────────────────

export function unsubscribeToken(unsubKey: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`unsub:${unsubKey}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(user: { id: string; emailUnsubKey: string }): string {
  return `${env.APP_URL}/email/unsubscribe?u=${encodeURIComponent(user.id)}&k=${unsubscribeToken(user.emailUnsubKey)}`;
}

// ──────────────────────────────── rendering ───────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(params: { heading: string; body: string[]; cta: { label: string; href: string }; unsubscribe: string }): RenderedEmail {
  const text = [
    params.heading,
    "",
    ...params.body,
    "",
    `${params.cta.label}: ${params.cta.href}`,
    "",
    "—",
    "HUSTL — hire other UW students for creative work.",
    `Stop these emails: ${params.unsubscribe}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:600;margin:0 0 12px">${escapeHtml(params.heading)}</p>
${params.body.map((line) => `<p style="margin:0 0 8px;color:#444">${escapeHtml(line)}</p>`).join("\n")}
<p style="margin:20px 0"><a href="${escapeHtml(params.cta.href)}" style="background:#5b2bd9;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;display:inline-block">${escapeHtml(params.cta.label)}</a></p>
<p style="font-size:12px;color:#888;margin-top:32px">HUSTL — hire other UW students for creative work.<br><a href="${escapeHtml(params.unsubscribe)}" style="color:#888">Stop these emails</a></p>
</body></html>`;

  return { subject: params.heading, text, html };
}

export function renderNotification(props: NotificationProps, unsubscribe: string): RenderedEmail {
  return layout({
    heading: props.line,
    body: [props.title],
    cta: { label: "Open in HUSTL", href: `${env.APP_URL}${props.href}` },
    unsubscribe,
  });
}

export function renderDigest(props: DigestProps, unsubscribe: string): RenderedEmail {
  const n = props.count;
  return layout({
    heading: `${n} new request${n === 1 ? "" : "s"} in your tags`,
    body: props.titles.slice(0, 5).map((t) => `• ${t}`).concat(n > 5 ? [`…and ${n - 5} more`] : []),
    cta: { label: "See open requests", href: `${env.APP_URL}${props.href}` },
    unsubscribe,
  });
}

// ─────────────────────────── loading from ids ─────────────────────────────

export type OutboxRow = { id: string; userId: string; template: string; payload: unknown };

/**
 * Turns an outbox row into a rendered email, or null when there is nothing
 * left to say (the notification was deleted, the digest window is empty).
 */
export async function renderOutboxRow(
  tx: Tx,
  row: OutboxRow,
  recipient: { id: string; emailUnsubKey: string },
): Promise<RenderedEmail | null> {
  const unsubscribe = unsubscribeUrl(recipient);
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  if (row.template === "notification") {
    const notificationId = String(payload.notificationId ?? "");
    const n = await tx.notification.findUnique({
      where: { id: notificationId },
      select: {
        kind: true,
        requestId: true,
        jobId: true,
        threadId: true,
        actor: { select: { displayName: true } },
        request: { select: { title: true } },
        job: { select: { request: { select: { title: true } } } },
      },
    });
    if (!n) return null;
    const title = n.request?.title ?? n.job?.request.title ?? "a request";
    return renderNotification(
      { line: NOTIFICATION_COPY[n.kind](n.actor?.displayName ?? "Someone", title), title, href: notificationHref(n) },
      unsubscribe,
    );
  }

  if (row.template === "digest") {
    const since = new Date(String(payload.since ?? new Date(0).toISOString()));
    const rows = await tx.notification.findMany({
      where: { userId: row.userId, kind: "OPEN_REQUEST_IN_TAG", createdAt: { gte: since }, readAt: null },
      select: { request: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    if (rows.length === 0) return null; // they already saw them in-app
    return renderDigest(
      { count: rows.length, titles: rows.map((r) => r.request?.title ?? "a request"), href: "/requests" },
      unsubscribe,
    );
  }

  return null;
}
