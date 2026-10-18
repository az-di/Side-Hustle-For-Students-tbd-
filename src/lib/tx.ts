import type { PrismaClient } from "@/generated/prisma/client";

/**
 * A database handle that is either the client or an interactive transaction.
 *
 * Use cases take a `Tx` so the same function works inside and outside a
 * transaction — which is what lets a state change and its notification rows be
 * written atomically without duplicating every query.
 */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;
