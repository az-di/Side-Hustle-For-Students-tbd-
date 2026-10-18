import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { STORAGE_KEY_SHAPE } from "./state";

/**
 * The media volume. Local disk today (this runs on one box with no 4.5 MB
 * serverless body cap, so the simple path works); the surface is small enough
 * that moving to Vultr Object Storage with presigned URLs is a swap of this
 * file plus mediaUrl().
 *
 * Every function validates the key shape before touching the filesystem, so a
 * key from the database or the URL can never become a path.
 */

function resolveKey(storageKey: string): string {
  if (!STORAGE_KEY_SHAPE.test(storageKey)) throw new Error("bad storage key");
  return path.join(path.resolve(env.MEDIA_DIR), storageKey);
}

export function newStorageKey(ext: string): string {
  return `${randomBytes(16).toString("hex")}.${ext}`;
}

export async function writeMedia(storageKey: string, bytes: Uint8Array): Promise<void> {
  const file = resolveKey(storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" }); // never overwrite
}

export async function removeMedia(storageKey: string): Promise<void> {
  try {
    await unlink(resolveKey(storageKey));
  } catch (err) {
    // Already gone is fine: the row is the source of truth and it is being deleted too.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export async function mediaExists(storageKey: string): Promise<boolean> {
  try {
    await stat(resolveKey(storageKey));
    return true;
  } catch {
    return false;
  }
}

export function openMedia(storageKey: string): { stream: NodeJS.ReadableStream; size: Promise<number> } {
  const file = resolveKey(storageKey);
  return { stream: createReadStream(file), size: stat(file).then((s) => s.size) };
}
