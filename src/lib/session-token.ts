import { createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Session token hashing, separated from lib/auth so code that cannot import
 * next/headers (tests, scripts) can still mint a session row.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** sha256 of the cookie value plus the secret; the raw token is never stored. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(`${token}${env.SESSION_SECRET}`).digest("hex");
}

export const SESSION_COOKIE = "hustl_session";
