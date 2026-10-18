import { z } from "zod";

/**
 * Validated environment. Imported by server code only.
 *
 * Deliberately permissive about RESEND_API_KEY: the app must run end to end
 * without it (OTP codes surface in DEMO_MODE instead), because an unverified
 * sending domain must never be able to block the build or the demo.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Must be stable across restarts, or every session cookie is invalidated. */
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  /** Peppers the OTP code hashes. */
  OTP_PEPPER: z.string().min(16, "OTP_PEPPER must be at least 16 chars"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("HUSTL <login@hustl.local>"),

  /** Only @uw.edu may sign up. Overridable so teammates can test locally. */
  ALLOWED_EMAIL_DOMAIN: z.string().default("uw.edu"),

  /**
   * DEMO_MODE=1 echoes OTP codes in the response and enables the persona
   * switcher. Never set this in a real deployment.
   */
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  /**
   * How long a job waits for the other party to confirm completion before it
   * auto-completes. 7 days in production; set to ~2 minutes for a live demo.
   */
  AUTO_COMPLETE_MS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60 * 1000),

  /** Default lifetime of a request when the buyer does not pick one. */
  REQUEST_DEFAULT_TTL_MS: z.coerce.number().int().positive().default(3 * 24 * 60 * 60 * 1000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
}

export const env = parsed.data;
export const isDemoMode = env.DEMO_MODE;
