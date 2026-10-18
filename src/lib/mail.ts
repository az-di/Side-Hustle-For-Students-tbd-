import { Resend } from "resend";
import { env, isDemoMode } from "./env";

/**
 * Email sending, behind one function so the app never depends on deliverability.
 *
 * Three implementations, picked at runtime:
 *   * Resend, when RESEND_API_KEY is set and the sending domain is verified
 *   * console, otherwise — the code is logged to the server output, so local
 *     development needs no email account at all
 *
 * In DEMO_MODE the OTP code is ALSO returned to the browser by the route that
 * calls this, so a DNS or deliverability problem cannot kill a live demo.
 */

type SendResult = { delivered: boolean; via: "resend" | "console"; error?: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function send(to: string, subject: string, text: string): Promise<SendResult> {
  if (!resend) {
    console.info(`\n──── email (no RESEND_API_KEY, logged instead) ────\nTo: ${to}\n${subject}\n\n${text}\n────\n`);
    return { delivered: false, via: "console" };
  }

  try {
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, text });
    if (error) {
      // Never throw: a failed email must not break sign-in when the code is
      // also visible in DEMO_MODE.
      console.error("resend error", error);
      return { delivered: false, via: "resend", error: error.message };
    }
    return { delivered: true, via: "resend" };
  } catch (err) {
    console.error("resend threw", err);
    return { delivered: false, via: "resend", error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<SendResult> {
  return send(
    to,
    `${code} is your HUSTL code`,
    [
      `Your HUSTL sign-in code is ${code}.`,
      "",
      "It expires in 10 minutes. If you did not request it, you can ignore this email.",
      "",
      "HUSTL — hire other UW students for creative work.",
    ].join("\n"),
  );
}

/**
 * Whether the UI may display the code on screen. True only in DEMO_MODE, so a
 * production deployment cannot leak codes even if email is misconfigured.
 */
export function mayEchoOtpCode(): boolean {
  return isDemoMode;
}
