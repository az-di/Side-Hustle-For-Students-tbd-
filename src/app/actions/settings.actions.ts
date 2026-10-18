"use server";

import { revalidatePath } from "next/cache";
import { requireAnyViewer } from "@/lib/auth";
import { setEmailOptOut } from "@/modules/email/mutations";
import { setAllInterestPreferences, setInterestPreference } from "@/modules/interests/mutations";

/** A suspended person may still turn email off, hence requireAnyViewer. */
export async function setEmailOptOutAction(formData: FormData): Promise<void> {
  const viewer = await requireAnyViewer();
  await setEmailOptOut({ userId: viewer.id, optOut: String(formData.get("optOut")) === "true" });
  revalidatePath("/settings/email");
}

export async function setWatchedTagAction(formData: FormData): Promise<void> {
  const viewer = await requireAnyViewer();
  await setInterestPreference({
    buyerUserId: viewer.id,
    tagId: String(formData.get("tagId") ?? ""),
    notifyOnNewSeller: String(formData.get("on")) === "true",
  });
  revalidatePath("/settings/watched-tags");
}

export async function setAllWatchedTagsAction(formData: FormData): Promise<void> {
  const viewer = await requireAnyViewer();
  await setAllInterestPreferences({ buyerUserId: viewer.id, notifyOnNewSeller: String(formData.get("on")) === "true" });
  revalidatePath("/settings/watched-tags");
}
