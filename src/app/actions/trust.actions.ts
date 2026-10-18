"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { toUserMessage } from "@/lib/errors";
import { blockUser, reportUser, resolveReport, setUserStatus, unblockUser } from "@/modules/trust/mutations";
import type { ActionState } from "./marketplace.actions";

/**
 * Trust and safety adapters. Same rule as marketplace.actions: parse, call the
 * module, map errors. The rules live in src/modules/trust.
 */

export async function blockUserAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const handle = String(formData.get("handle") ?? "");
  const target = await db.user.findUnique({ where: { handle }, select: { id: true } });
  if (target) await blockUser({ blockerUserId: viewer.id, blockedUserId: target.id });

  revalidatePath(`/sellers/${handle}`);
  revalidatePath("/settings/safety");
  revalidatePath("/threads");
  revalidatePath("/requests");
}

export async function unblockUserAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const handle = String(formData.get("handle") ?? "");
  const target = await db.user.findUnique({ where: { handle }, select: { id: true } });
  if (target) await unblockUser({ blockerUserId: viewer.id, blockedUserId: target.id });

  revalidatePath(`/sellers/${handle}`);
  revalidatePath("/settings/safety");
  revalidatePath("/threads");
  revalidatePath("/requests");
}

const reportSchema = z.object({
  handle: z.string().min(1),
  kind: z.enum(["NO_SHOW", "ABUSIVE", "SCAM", "ACADEMIC_DISHONESTY", "OFF_PLATFORM_PRESSURE", "SPAM", "OTHER"]),
  reason: z.string().trim().min(10, "Say a little more about what happened.").max(2000),
  jobId: z.string().optional(),
  block: z.boolean(),
});

export async function reportUserAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();

  try {
    const input = reportSchema.parse({
      handle: formData.get("handle"),
      kind: formData.get("kind"),
      reason: formData.get("reason"),
      jobId: formData.get("jobId") || undefined,
      block: formData.get("block") === "on",
    });

    const subject = await db.user.findUnique({ where: { handle: input.handle }, select: { id: true } });
    if (!subject) return { error: "That person could not be found." };

    await reportUser({
      reporterUserId: viewer.id,
      subjectUserId: subject.id,
      kind: input.kind,
      reason: input.reason,
      jobId: input.jobId ?? null,
    });
    if (input.block) await blockUser({ blockerUserId: viewer.id, blockedUserId: subject.id });
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form." };
    return { error: toUserMessage(err) };
  }

  revalidatePath("/settings/safety");
  return { ok: true };
}

// ────────────────────────────────── admin ─────────────────────────────────

export async function resolveReportAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const reportId = String(formData.get("reportId") ?? "");
  const outcome = String(formData.get("outcome")) === "UPHELD" ? "UPHELD" : "DISMISSED";

  await resolveReport({ adminUserId: viewer.id, reportId, outcome });
  revalidatePath("/admin/reports");
}

export async function setUserStatusAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const userId = String(formData.get("userId") ?? "");
  const status = z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).parse(formData.get("status"));

  await setUserStatus({ adminUserId: viewer.id, userId, status });
  revalidatePath("/admin/reports");
  redirect("/admin/reports");
}
