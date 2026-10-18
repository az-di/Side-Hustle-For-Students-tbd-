/**
 * Messaging rules, pure.
 *
 * Threads are scoped to a request, a response or a job, so there is no way to
 * cold-message a stranger — with one deliberate exception: a buyer may open
 * ONE inquiry thread per seller before requesting ("are you free on the 7th?").
 * The rate limit below is what stops that exception becoming a spam channel.
 */

export const MAX_NEW_INQUIRIES_PER_DAY = 5;
export const MAX_MESSAGE_LENGTH = 4_000;

/** One inquiry thread per buyer/seller pair, enforced by Thread.inquiryKey @unique. */
export function inquiryKey(buyerUserId: string, sellerUserId: string): string {
  return `${buyerUserId}:${sellerUserId}`;
}

export type InquiryDecision = { ok: true } | { ok: false; message: string };

export function canOpenInquiry(input: { isSelf: boolean; sellerExists: boolean; openedToday: number }): InquiryDecision {
  if (input.isSelf) return { ok: false, message: "You cannot message yourself." };
  if (!input.sellerExists) return { ok: false, message: "That person is not selling right now." };
  if (input.openedToday >= MAX_NEW_INQUIRIES_PER_DAY) {
    return { ok: false, message: `You can start ${MAX_NEW_INQUIRIES_PER_DAY} new conversations a day. Try again tomorrow.` };
  }
  return { ok: true };
}
