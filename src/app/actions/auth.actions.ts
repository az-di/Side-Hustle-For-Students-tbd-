"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuthError,
  assertAllowedEmail,
  createOtpChallenge,
  endSession,
  startSession,
  verifyOtpAndSignIn,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { mayEchoOtpCode, sendOtpEmail } from "@/lib/mail";

export type RequestCodeState = {
  ok: boolean;
  email?: string;
  /** Present only in DEMO_MODE — never in a real deployment. */
  demoCode?: string;
  emailDelivered?: boolean;
  error?: string;
};

export async function requestCodeAction(
  _prev: RequestCodeState | undefined,
  formData: FormData,
): Promise<RequestCodeState> {
  const raw = String(formData.get("email") ?? "");

  try {
    const email = assertAllowedEmail(raw);
    const { code } = await createOtpChallenge(email);
    const delivery = await sendOtpEmail(email, code);

    return {
      ok: true,
      email,
      emailDelivered: delivery.delivered,
      demoCode: mayEchoOtpCode() ? code : undefined,
    };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    console.error("requestCodeAction", err);
    return { ok: false, error: "Something went wrong sending that code. Try again." };
  }
}

export type VerifyCodeState = { error?: string };

export async function verifyCodeAction(
  _prev: VerifyCodeState | undefined,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = z
    .object({
      email: z.string().min(3),
      code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
    })
    .safeParse({
      email: String(formData.get("email") ?? ""),
      code: String(formData.get("code") ?? "").trim(),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." };
  }

  let isNewUser = false;
  try {
    const result = await verifyOtpAndSignIn(parsed.data.email, parsed.data.code);
    isNewUser = result.isNewUser;
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    console.error("verifyCodeAction", err);
    return { error: "Could not sign you in. Try requesting a new code." };
  }

  // redirect() throws, so it must sit outside the try block.
  redirect(isNewUser ? "/welcome" : "/");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

/**
 * DEMO_MODE only: sign in as a seeded persona without an email round trip.
 *
 * This is how you switch between buyer and seller a hundred times while
 * building, and how the two-screens-side-by-side moment works on stage. The
 * gate below is why it cannot be used in a real deployment.
 */
export async function demoSignInAction(formData: FormData): Promise<void> {
  if (!isDemoMode) {
    throw new Error("Demo sign-in is disabled.");
  }

  const handle = String(formData.get("handle") ?? "");
  const user = await db.user.findFirst({
    where: { handle, isDemo: true, uwEmail: { endsWith: `@${env.ALLOWED_EMAIL_DOMAIN}` } },
    select: { id: true },
  });

  if (!user) throw new Error(`No demo persona named ${handle}`);

  await endSession();
  await startSession(user.id);
  redirect("/");
}
