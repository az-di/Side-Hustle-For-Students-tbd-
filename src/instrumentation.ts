/**
 * Runs once when the Next server boots. This app runs as one long-lived Node
 * process on its own box (not serverless), so a plain timer is the right tool
 * for draining the email outbox — no external scheduler to provision.
 *
 * Imports are dynamic so the Edge runtime (which also evaluates this file)
 * never pulls in Postgres.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/env");
  if (env.EMAIL_DRAIN_INTERVAL_MS <= 0) return;

  const { drainOutbox } = await import("@/modules/email/outbox");
  const { pruneRateLimits } = await import("@/modules/ratelimit/mutations");

  let running = false;
  let ticks = 0;
  const tick = async () => {
    if (running) return; // a slow send must not stack drains
    running = true;
    try {
      const tally = await drainOutbox();
      if (tally.sent + tally.failed + tally.retried + tally.skipped > 0) {
        console.info("email outbox", tally);
      }
      // Housekeeping rides on the same timer, roughly hourly.
      if (++ticks % 60 === 0) await pruneRateLimits();
    } catch (err) {
      console.error("email outbox drain failed", err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, env.EMAIL_DRAIN_INTERVAL_MS);
  timer.unref(); // never keep the process alive just for this
}
