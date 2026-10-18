import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/errors";
import type { Tx } from "@/lib/tx";
import { RATE_LIMITS, isOverLimit, rateLimitKey, type RateLimitAction } from "./state";

/**
 * Counts a hit and throws RATE_LIMITED if it is one too many.
 *
 * One atomic statement: insert the row, or bump it — resetting the window if
 * it has elapsed — and return the new count. Two concurrent hits cannot both
 * read "4" and both write "5", because the increment happens in the UPDATE.
 * The clock is bound from JS (see HANDOFF §10 on `now()`).
 */
export async function consumeRateLimit(action: RateLimitAction, subject: string, tx: Tx = db, now = new Date()): Promise<void> {
  const rule = RATE_LIMITS[action];
  const key = rateLimitKey(action, subject);
  const cutoff = new Date(now.getTime() - rule.windowMs);

  const rows = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"
  `);

  const count = rows[0]?.count ?? 1;
  if (isOverLimit(count, rule)) throw rateLimited(rule.message);
}

/** Rows whose window ended more than a day ago are dead weight. Called by the drain timer. */
export async function pruneRateLimits(now = new Date()): Promise<number> {
  const longest = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));
  const result = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - longest - 24 * 60 * 60 * 1000) } } });
  return result.count;
}
