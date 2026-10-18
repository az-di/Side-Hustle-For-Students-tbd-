import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unsubscribeToken } from "@/modules/email/templates";

/**
 * One-click unsubscribe. No session needed: the link carries the user id and
 * an HMAC of their private unsubscribe key, so it can be clicked from any
 * device. GET renders a confirmation page; POST is what mail clients send for
 * RFC 8058 List-Unsubscribe-Post.
 */
async function unsubscribe(req: Request): Promise<{ ok: boolean }> {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("k") ?? "";
  if (!userId || !token) return { ok: false };

  const user = await db.user.findUnique({ where: { id: userId }, select: { emailUnsubKey: true } });
  if (!user) return { ok: false };

  const expected = Buffer.from(unsubscribeToken(user.emailUnsubKey));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false };

  await db.user.update({ where: { id: userId }, data: { emailOptOut: true } });
  return { ok: true };
}

function page(title: string, body: string, status: number): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · HUSTL</title></head>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#1a1a1a">
<h1 style="font-size:20px">${title}</h1><p style="color:#444">${body}</p>
<p><a href="/settings/email" style="color:#5b2bd9">Email settings</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const { ok } = await unsubscribe(req);
  return ok
    ? page("You are unsubscribed", "HUSTL will not email you about requests, responses or jobs. Notifications still show in the app, and you can turn email back on in settings.", 200)
    : page("That link did not work", "It may be from an old email. Sign in and change your email preference in settings instead.", 400);
}

export async function POST(req: Request) {
  const { ok } = await unsubscribe(req);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}
