import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";

const SESSION_COOKIE = "hustl_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "WRONG_DOMAIN"
      | "INVALID_EMAIL"
      | "NO_CHALLENGE"
      | "EXPIRED"
      | "TOO_MANY_ATTEMPTS"
      | "BAD_CODE"
      | "NOT_SIGNED_IN",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ───────────────────────────── the uw.edu gate ─────────────────────────────

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The entire trust pitch versus Fiverr lives in this function: a verified fellow
 * student, not a stranger. Also enforced by a CHECK constraint on User.uwEmail,
 * so a bug here cannot put a non-UW row in the database.
 */
export function assertAllowedEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("That does not look like an email address.", "INVALID_EMAIL");
  }
  if (!email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`)) {
    throw new AuthError(
      `HUSTL is UW students only — please use your @${env.ALLOWED_EMAIL_DOMAIN} address.`,
      "WRONG_DOMAIN",
    );
  }
  return email;
}

// ──────────────────────────────── OTP codes ────────────────────────────────

function hashOtp(code: string): string {
  return createHmac("sha256", env.OTP_PEPPER).update(code).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Issues a 6-digit code for an @uw.edu address. Returns the plaintext code so
 * the caller can mail it — and, in DEMO_MODE only, show it on screen.
 */
export async function createOtpChallenge(rawEmail: string): Promise<{ email: string; code: string }> {
  const email = assertAllowedEmail(rawEmail);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await db.otpChallenge.create({
    data: {
      email,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return { email, code };
}

/** Derives a unique @handle from an email local part: "maya.chen" -> "mayachen". */
async function uniqueHandle(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "student";

  for (let suffix = 0; suffix < 200; suffix++) {
    const candidate = suffix === 0 ? base : `${base}${suffix}`;
    const taken = await db.user.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${randomBytes(3).toString("hex")}`;
}

/**
 * Verifies a code and signs the user in, creating the account on first use.
 * Every failure path burns an attempt, so the code cannot be brute-forced.
 */
export async function verifyOtpAndSignIn(rawEmail: string, rawCode: string): Promise<{ userId: string; isNewUser: boolean }> {
  const email = assertAllowedEmail(rawEmail);
  const code = rawCode.trim();

  const challenge = await db.otpChallenge.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    throw new AuthError("Request a new code to continue.", "NO_CHALLENGE");
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AuthError("That code expired. Request a new one.", "EXPIRED");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError("Too many attempts. Request a new code.", "TOO_MANY_ATTEMPTS");
  }

  if (!constantTimeEquals(hashOtp(code), challenge.codeHash)) {
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthError("That code is not right.", "BAD_CODE");
  }

  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const existing = await db.user.findUnique({ where: { uwEmail: email }, select: { id: true } });

  const userId =
    existing?.id ??
    (
      await db.user.create({
        data: {
          uwEmail: email,
          handle: await uniqueHandle(email),
          displayName: email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        },
        select: { id: true },
      })
    ).id;

  await startSession(userId);
  return { userId, isNewUser: !existing };
}

// ───────────────────────────────── sessions ────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}${env.SESSION_SECRET}`).digest("hex");
}

/** Creates a session row and sets the cookie. The raw token is never stored. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export type Viewer = {
  id: string;
  handle: string;
  displayName: string;
  uwEmail: string;
  avatarUrl: string | null;
  venmoHandle: string | null;
  isAdmin: boolean;
  isSeller: boolean;
};

/** The signed-in user, or null. Safe to call from any server component. */
export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          uwEmail: true,
          avatarUrl: true,
          venmoHandle: true,
          isAdmin: true,
          sellerProfile: { select: { userId: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  const { user } = session;
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    uwEmail: user.uwEmail,
    avatarUrl: user.avatarUrl,
    venmoHandle: user.venmoHandle,
    isAdmin: user.isAdmin,
    isSeller: user.sellerProfile !== null,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError("Sign in to continue.", "NOT_SIGNED_IN");
  return viewer;
}
