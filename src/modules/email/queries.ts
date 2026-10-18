import { db } from "@/lib/db";

export async function getEmailSettings(userId: string) {
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: { emailOptOut: true, uwEmail: true } });
}

export async function listRecentEmails(userId: string, limit = 10) {
  return db.outboundEmail.findMany({
    where: { userId },
    select: { id: true, template: true, status: true, createdAt: true, sentAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
