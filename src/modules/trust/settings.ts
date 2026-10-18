import { db } from "@/lib/db";
import type { Tx } from "@/lib/tx";

/**
 * Numbers that must be changeable without a deploy live in PlatformSetting.
 * Edit them in Prisma Studio (the admin console for now).
 */

export const SETTING_KEYS = {
  /** Weighted report total at which an account is auto-suspended. */
  reportSuspendThreshold: "report_suspend_threshold",
} as const;

const DEFAULTS: Record<string, number> = {
  [SETTING_KEYS.reportSuspendThreshold]: 3,
};

export async function getNumberSetting(key: string, tx: Tx = db): Promise<number> {
  const row = await tx.platformSetting.findUnique({ where: { key }, select: { value: true } });
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) ? parsed : (DEFAULTS[key] ?? 0);
}
