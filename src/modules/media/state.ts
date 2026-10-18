import type { MediaKind } from "@/generated/prisma/enums";

/**
 * Media rules, pure.
 *
 * The content type is decided by sniffing the first bytes, never by the
 * upload's declared MIME type or its filename — both are attacker-controlled.
 * Anything not on this list is refused, so an HTML or SVG file (both of which
 * can run script when served) can never be stored.
 */

export const MAX_PORTFOLIO_ITEMS = 24;
export const MAX_CAPTION_LENGTH = 140;

export type SniffedType = { kind: MediaKind; mimeType: string; ext: string };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function sniffMediaType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "IMAGE", mimeType: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "IMAGE", mimeType: "image/png", ext: "png" };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return { kind: "IMAGE", mimeType: "image/gif", ext: "gif" };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { kind: "IMAGE", mimeType: "image/webp", ext: "webp" };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "qt  ") return { kind: "VIDEO", mimeType: "video/quicktime", ext: "mov" };
    // isom, iso2, mp41, mp42, avc1, M4V … — all MP4-family.
    return { kind: "VIDEO", mimeType: "video/mp4", ext: "mp4" };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "VIDEO", mimeType: "video/webm", ext: "webm" };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { kind: "PDF", mimeType: "application/pdf", ext: "pdf" };
  return null;
}

export type LimitCheck = { ok: true } | { ok: false; message: string };

export function checkUploadLimits(input: {
  bytes: number;
  usedBytes: number;
  itemCount: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}): LimitCheck {
  if (input.bytes <= 0) return { ok: false, message: "That file is empty." };
  if (input.bytes > input.maxFileBytes) {
    return { ok: false, message: `That file is too big — the limit is ${formatBytes(input.maxFileBytes)}.` };
  }
  if (input.usedBytes + input.bytes > input.maxTotalBytes) {
    return {
      ok: false,
      message: `You have used ${formatBytes(input.usedBytes)} of your ${formatBytes(input.maxTotalBytes)}. Delete something first.`,
    };
  }
  if (input.itemCount >= MAX_PORTFOLIO_ITEMS) {
    return { ok: false, message: `A portfolio holds up to ${MAX_PORTFOLIO_ITEMS} items. Delete one to add another.` };
  }
  return { ok: true };
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** The URL a stored asset is served from. One place, so it can move to object storage later. */
export function mediaUrl(storageKey: string): string {
  return `/media/${storageKey}`;
}

/** Storage keys are bare filenames; the DB CHECK enforces the same shape. */
export const STORAGE_KEY_SHAPE = /^[a-z0-9]+\.[a-z0-9]+$/;
