"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { toUserMessage } from "@/lib/errors";
import { deletePortfolioItem, uploadPortfolioMedia } from "@/modules/media/mutations";
import type { ActionState } from "./marketplace.actions";

export async function uploadPortfolioAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a file first." };

  try {
    await uploadPortfolioMedia({
      sellerUserId: viewer.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      caption: String(formData.get("caption") ?? ""),
    });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath("/settings/seller");
  revalidatePath(`/sellers/${viewer.handle}`);
  return { ok: true };
}

export async function deletePortfolioItemAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await deletePortfolioItem({ sellerUserId: viewer.id, itemId: String(formData.get("itemId") ?? "") });
  revalidatePath("/settings/seller");
  revalidatePath(`/sellers/${viewer.handle}`);
}
