"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAnyViewer, requireViewer } from "@/lib/auth";
import { toUserMessage } from "@/lib/errors";
import { parseDollarsToCents } from "@/lib/money";
import { becomeSeller, saveListing, saveSellerProfile, setSellerPaused, setSellerTag } from "@/modules/catalog/mutations";
import {
  acceptDirectRequest,
  cancelRequest,
  createDirectRequest,
  createOpenRequest,
  declineDirectRequest,
  respondToOpenRequest,
  selectResponse,
} from "@/modules/requests/mutations";
import {
  cancelJob,
  confirmJobComplete,
  createReview,
  markJobComplete,
  rejectJobCompletion,
} from "@/modules/jobs/mutations";
import { getUserIdByHandle } from "@/modules/identity/queries";
import { markThreadRead, openInquiry, sendMessage } from "@/modules/messaging/mutations";
import { markAllNotificationsRead } from "@/modules/notifications/mutations";

/**
 * Every mutation the UI can trigger.
 *
 * These are adapters and nothing more: parse the form, call the module, map an
 * error to a message. No business rules live here — they are in the state
 * machines, where they are unit-tested.
 */

export type ActionState = { error?: string; ok?: boolean };

const money = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || v.trim() === "") return null;
    return parseDollarsToCents(v);
  });

// ──────────────────────────────── requests ────────────────────────────────

const createRequestSchema = z.object({
  kind: z.enum(["OPEN", "DIRECT"]),
  targetSellerUserId: z.string().optional(),
  listingId: z.string().optional(),
  title: z.string().trim().min(4, "Give it a title people will understand.").max(140),
  details: z.string().trim().min(10, "Add a sentence or two of detail.").max(4000),
  fixed: money,
  hourly: money,
  tagIds: z.string().transform((v) => v.split(",").filter(Boolean)),
  ttlHours: z.coerce.number().int().positive().max(720).optional(),
});

export async function createRequestAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();

  let destination: string;
  try {
    const input = createRequestSchema.parse({
      kind: formData.get("kind"),
      targetSellerUserId: formData.get("targetSellerUserId") || undefined,
      listingId: formData.get("listingId") || undefined,
      title: formData.get("title"),
      details: formData.get("details"),
      fixed: formData.get("fixed") ?? undefined,
      hourly: formData.get("hourly") ?? undefined,
      tagIds: formData.get("tagIds") ?? "",
      ttlHours: formData.get("ttlHours") || undefined,
    });

    const common = {
      buyerUserId: viewer.id,
      title: input.title,
      details: input.details,
      // The amounts the buyer types are their GROSS ceiling.
      grossFixedBudgetCents: input.fixed,
      grossHourlyBudgetCents: input.hourly,
      tagIds: input.tagIds,
      ttlMs: input.ttlHours ? input.ttlHours * 60 * 60 * 1000 : undefined,
      listingId: input.listingId ?? null,
    };

    if (input.kind === "DIRECT") {
      if (!input.targetSellerUserId) return { error: "That seller could not be found." };
      const { requestId } = await createDirectRequest({
        ...common,
        targetSellerUserId: input.targetSellerUserId,
      });
      destination = `/requests/${requestId}`;
    } else {
      const { requestId } = await createOpenRequest(common);
      destination = `/requests/${requestId}`;
    }
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form and try again." };
    return { error: toUserMessage(err) };
  }

  revalidatePath("/requests");
  redirect(destination);
}

export async function respondToRequestAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  const requestId = String(formData.get("requestId") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 5) return { error: "Say something about how you would approach it." };

  try {
    await respondToOpenRequest({ requestId, sellerUserId: viewer.id, message });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
  return { ok: true };
}

export async function selectResponseAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const requestId = String(formData.get("requestId") ?? "");
  const responseId = String(formData.get("responseId") ?? "");

  const { jobId } = await selectResponse({ requestId, buyerUserId: viewer.id, responseId });

  revalidatePath(`/requests/${requestId}`);
  redirect(`/jobs/${jobId}`);
}

export async function acceptDirectRequestAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const requestId = String(formData.get("requestId") ?? "");

  const { jobId } = await acceptDirectRequest({ requestId, sellerUserId: viewer.id });

  revalidatePath("/requests");
  redirect(`/jobs/${jobId}`);
}

export async function declineDirectRequestAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const requestId = String(formData.get("requestId") ?? "");

  await declineDirectRequest({ requestId, sellerUserId: viewer.id });

  revalidatePath("/requests");
  redirect("/requests");
}

export async function cancelRequestAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const requestId = String(formData.get("requestId") ?? "");

  await cancelRequest({ requestId, buyerUserId: viewer.id });

  revalidatePath(`/requests/${requestId}`);
  redirect("/requests");
}

// ────────────────────────────────── jobs ──────────────────────────────────

export async function markCompleteAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  const jobId = String(formData.get("jobId") ?? "");

  try {
    await markJobComplete({ jobId, actorUserId: viewer.id });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function confirmCompleteAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  const jobId = String(formData.get("jobId") ?? "");

  try {
    await confirmJobComplete({ jobId, actorUserId: viewer.id });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function rejectCompletionAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const jobId = String(formData.get("jobId") ?? "");

  await rejectJobCompletion({ jobId, actorUserId: viewer.id });
  revalidatePath(`/jobs/${jobId}`);
}

export async function cancelJobAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const jobId = String(formData.get("jobId") ?? "");

  await cancelJob({ jobId, actorUserId: viewer.id });
  revalidatePath(`/jobs/${jobId}`);
}

export async function reviewAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const jobId = String(formData.get("jobId") ?? "");
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();

  try {
    await createReview({ jobId, buyerUserId: viewer.id, rating, body: body || null });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

// ──────────────────────────────── messaging ───────────────────────────────

export async function sendMessageAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "");

  try {
    await sendMessage({ threadId, senderUserId: viewer.id, body });
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath(`/threads/${threadId}`);
  return { ok: true };
}

/** "Message" on a seller profile: opens or returns to the one inquiry thread with them. */
export async function openInquiryAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const sellerUserId = await getUserIdByHandle(String(formData.get("handle") ?? ""));
  if (!sellerUserId) return { error: "That person could not be found." };

  let threadId: string;
  try {
    ({ threadId } = await openInquiry({ buyerUserId: viewer.id, sellerUserId }));
  } catch (err) {
    return { error: toUserMessage(err) };
  }

  revalidatePath("/threads");
  redirect(`/threads/${threadId}`);
}

export async function markThreadReadAction(threadId: string): Promise<void> {
  const viewer = await requireAnyViewer();
  await markThreadRead({ threadId, userId: viewer.id });
}

export async function markAllReadAction(): Promise<void> {
  const viewer = await requireAnyViewer();
  await markAllNotificationsRead(viewer.id);
  revalidatePath("/notifications");
}

// ─────────────────────── seller profile and listings ──────────────────────

export async function becomeSellerAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await becomeSeller({ userId: viewer.id, headline: String(formData.get("headline") ?? "").trim() || null });

  revalidatePath("/settings/seller");
  redirect("/settings/seller");
}

export async function setPausedAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await setSellerPaused({ userId: viewer.id, paused: String(formData.get("paused")) === "true" });
  revalidatePath("/settings/seller");
}

export async function toggleSellerTagAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  await setSellerTag({
    userId: viewer.id,
    tagId: String(formData.get("tagId") ?? ""),
    on: String(formData.get("on")) === "true",
  });

  revalidatePath("/settings/seller");
  revalidatePath("/requests");
}

export async function saveSellerProfileAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();

  try {
    const input = z
      .object({
        displayName: z.string().trim().min(2).max(60),
        bio: z.string().trim().max(500).optional(),
        headline: z.string().trim().max(120).optional(),
        about: z.string().trim().max(2000).optional(),
        venmoHandle: z.string().trim().max(40).optional(),
        // Seller-authored prices are NET: what they take home.
        fixed: money,
        hourly: money,
        portfolioLinks: z.string().optional(),
      })
      .parse({
        displayName: formData.get("displayName"),
        bio: formData.get("bio") ?? undefined,
        headline: formData.get("headline") ?? undefined,
        about: formData.get("about") ?? undefined,
        venmoHandle: formData.get("venmoHandle") ?? undefined,
        fixed: formData.get("fixed") ?? undefined,
        hourly: formData.get("hourly") ?? undefined,
        portfolioLinks: formData.get("portfolioLinks") ?? undefined,
      });

    await saveSellerProfile({
      userId: viewer.id,
      displayName: input.displayName,
      bio: input.bio || null,
      headline: input.headline || null,
      about: input.about || null,
      venmoHandle: input.venmoHandle || null,
      fixedPriceCents: input.fixed,
      hourlyRateCents: input.hourly,
      portfolioLinks: (input.portfolioLinks ?? "").split(/[\n,]/),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form." };
    return { error: toUserMessage(err) };
  }

  revalidatePath("/settings/seller");
  return { ok: true };
}

export async function saveListingAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();

  try {
    const input = z
      .object({
        listingId: z.string().optional(),
        title: z.string().trim().min(4).max(140),
        description: z.string().trim().min(10).max(4000),
        fixed: money,
        hourly: money,
        turnaroundDays: z.coerce.number().int().positive().max(120).optional(),
        tagIds: z.string().transform((v) => v.split(",").filter(Boolean)),
      })
      .parse({
        listingId: formData.get("listingId") || undefined,
        title: formData.get("title"),
        description: formData.get("description"),
        fixed: formData.get("fixed") ?? undefined,
        hourly: formData.get("hourly") ?? undefined,
        turnaroundDays: formData.get("turnaroundDays") || undefined,
        tagIds: formData.get("tagIds") ?? "",
      });

    await saveListing({
      sellerUserId: viewer.id,
      listingId: input.listingId ?? null,
      title: input.title,
      description: input.description,
      fixedPriceCents: input.fixed,
      hourlyRateCents: input.hourly,
      turnaroundDays: input.turnaroundDays ?? null,
      tagIds: input.tagIds,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form." };
    return { error: toUserMessage(err) };
  }

  revalidatePath("/settings/seller");
  return { ok: true };
}
