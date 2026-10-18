"use server";

import { revalidatePath } from "next/cache";
import { requireAnyViewer } from "@/lib/auth";
import { setEmailOptOut } from "@/modules/email/mutations";

/** A suspended person may still turn email off, hence requireAnyViewer. */
export async function setEmailOptOutAction(formData: FormData): Promise<void> {
  const viewer = await requireAnyViewer();
  await setEmailOptOut({ userId: viewer.id, optOut: String(formData.get("optOut")) === "true" });
  revalidatePath("/settings/email");
}
