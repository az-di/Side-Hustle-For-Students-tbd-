"use server";

import { revalidatePath } from "next/cache";
import { requireAnyViewer } from "@/lib/auth";
import { db } from "@/lib/db";

/** A suspended person may still turn email off, hence requireAnyViewer. */
export async function setEmailOptOutAction(formData: FormData): Promise<void> {
  const viewer = await requireAnyViewer();
  const optOut = String(formData.get("optOut")) === "true";
  await db.user.update({ where: { id: viewer.id }, data: { emailOptOut: optOut } });
  revalidatePath("/settings/email");
}
