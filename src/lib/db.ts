import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * The single PrismaClient for the process.
 *
 * Prisma 7 is Rust-free and requires a driver adapter, so `pg` does the talking.
 * Because this runs as a long-lived Node process on our own box (not serverless),
 * a normal connection pool is exactly right — no pgbouncer flags, no per-request
 * connection churn.
 *
 * The global cache keeps `next dev` HMR from opening a new pool on every reload.
 */
const globalForDb = globalThis as unknown as { hustlDb?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForDb.hustlDb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.hustlDb = db;
}
