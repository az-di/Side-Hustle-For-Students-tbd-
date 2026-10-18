"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { toUserMessage } from "@/lib/errors";
import {
  createTag,
  resolveReport,
  setReportThreshold,
  setTagActive,
  setUserAdmin,
  setUserStatus,
  updateTag,
} from "@/modules/admin/mutations";
import type { ActionState } from "./marketplace.actions";

/**
 * Admin adapters. The admin check itself happens inside withAudit in the
 * module, so a page that forgets the layout guard still cannot write.
 */

const tagSchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(["SERVICE", "COURSE"]),
  synonyms: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean)),
  sortOrder: z.coerce.number().int().default(200),
});

function parseTag(formData: FormData) {
  return tagSchema.parse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    synonyms: formData.get("synonyms") ?? "",
    sortOrder: formData.get("sortOrder") || 200,
  });
}

export async function createTagAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  try {
    await createTag(viewer.id, parseTag(formData));
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form." };
    return { error: toUserMessage(err) };
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function updateTagAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  try {
    await updateTag(viewer.id, String(formData.get("tagId") ?? ""), parseTag(formData));
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form." };
    return { error: toUserMessage(err) };
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function setTagActiveAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await setTagActive(viewer.id, String(formData.get("tagId") ?? ""), String(formData.get("isActive")) === "true");
  revalidatePath("/admin/tags");
  revalidatePath("/search");
}

export async function setUserAdminAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await setUserAdmin(viewer.id, String(formData.get("userId") ?? ""), String(formData.get("isAdmin")) === "true");
  revalidatePath("/admin/users");
}

export async function setUserStatusAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const status = z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).parse(formData.get("status"));
  await setUserStatus(viewer.id, String(formData.get("userId") ?? ""), status);
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
}

export async function resolveReportAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const outcome = String(formData.get("outcome")) === "UPHELD" ? "UPHELD" : "DISMISSED";
  await resolveReport(viewer.id, String(formData.get("reportId") ?? ""), outcome);
  revalidatePath("/admin/reports");
}

export async function setReportThresholdAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  try {
    await setReportThreshold(viewer.id, Number(formData.get("threshold")));
  } catch (err) {
    return { error: toUserMessage(err) };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return { ok: true };
}
