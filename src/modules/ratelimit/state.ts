/**
 * Rate limits, pure.
 *
 * Fixed windows: the first hit in a window starts it, and the count resets
 * when the next hit lands after the window has elapsed. Simple, one row per
 * subject, and good enough to stop a script — these are not billing meters.
 */

export type RateLimitRule = { max: number; windowMs: number; message: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RATE_LIMITS = {
  /** Sign-in codes requested from one IP. */
  otp_ip: { max: 20, windowMs: 15 * MIN, message: "Too many sign-in attempts from this network. Try again in 15 minutes." },
  /** Sign-in codes requested for one address. */
  otp_email: { max: 5, windowMs: 15 * MIN, message: "Too many codes requested for that address. Use the one you have, or wait 15 minutes." },
  /** Code verification attempts per address (on top of the 5-attempts-per-code rule). */
  otp_verify: { max: 15, windowMs: 15 * MIN, message: "Too many attempts. Request a new code in 15 minutes." },
  request_create: { max: 10, windowMs: HOUR, message: "You have posted a lot of requests this hour. Give sellers a chance to respond." },
  response_create: { max: 30, windowMs: HOUR, message: "You have responded to a lot of requests this hour. Try again later." },
  message_send: { max: 120, windowMs: HOUR, message: "You are sending messages very quickly. Take a breather." },
  report_create: { max: 5, windowMs: DAY, message: "You have filed several reports today. They are being reviewed." },
  upload: { max: 30, windowMs: HOUR, message: "That is a lot of uploads for one hour. Try again later." },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export function rateLimitKey(action: RateLimitAction, subject: string): string {
  return `${action}:${subject}`;
}

/** Has the window that started at `windowStart` elapsed by `now`? */
export function windowExpired(windowStart: Date, windowMs: number, now: Date): boolean {
  return now.getTime() - windowStart.getTime() >= windowMs;
}

/** Given the count AFTER this hit, is it over the line? */
export function isOverLimit(countAfterHit: number, rule: RateLimitRule): boolean {
  return countAfterHit > rule.max;
}

/** The first value of X-Forwarded-For, or the fallback. Traefik sets the header in front of us. */
export function clientIpFrom(forwardedFor: string | null, fallback = "unknown"): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : fallback;
}
