/**
 * Watched-tag rules, pure.
 *
 * "A buyer is notified when a seller becomes open to a tag they requested" is
 * one line in the spec and, without these limits, the app's main spam source:
 * a seller toggling pause twice a day would ping hundreds of buyers each time.
 */

/** A buyer whose last request under the tag is older than this is not told. */
export const WATCH_WINDOW_DAYS = 90;

/** Most-recently-active watchers notified per event. */
export const MAX_WATCHERS_PER_EVENT = 200;

/** At most one alert per buyer, per seller, per tag, per calendar month. */
export function sellerOpenDedupeKey(sellerUserId: string, tagId: string, now: Date): string {
  return `seller_open:${sellerUserId}:${tagId}:${now.toISOString().slice(0, 7)}`;
}

export function watchWindowStart(now: Date): Date {
  return new Date(now.getTime() - WATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Would this interest row be told about a seller opening up right now? */
export function isWatching(
  interest: { notifyOnNewSeller: boolean; lastRequestedAt: Date; mutedUntil: Date | null },
  now: Date,
): boolean {
  if (!interest.notifyOnNewSeller) return false;
  if (interest.mutedUntil !== null && interest.mutedUntil.getTime() > now.getTime()) return false;
  return interest.lastRequestedAt.getTime() >= watchWindowStart(now).getTime();
}
