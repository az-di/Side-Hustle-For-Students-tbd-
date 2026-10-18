import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { drainOutbox } from "@/modules/email/outbox";

/**
 * Drains the email outbox once. For an external scheduler (Coolify cron, a
 * GitHub Action, curl in a crontab):
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/email/drain
 *
 * The in-process timer (src/instrumentation.ts) does the same thing on a
 * schedule, so this only matters when EMAIL_DRAIN_INTERVAL_MS=0 or you want a
 * manual kick. Disabled entirely when CRON_SECRET is unset.
 */
export async function POST(req: Request) {
  if (!env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 404 });

  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(env.CRON_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tally = await drainOutbox(200);
  return NextResponse.json(tally, { headers: { "Cache-Control": "no-store" } });
}
