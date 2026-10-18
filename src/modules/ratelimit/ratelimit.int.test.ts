import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { uniq } from "@/test/factories";
import { consumeRateLimit, pruneRateLimits } from "./mutations";
import { RATE_LIMITS } from "./state";

afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { key: { contains: "rl-test" } } });
  await db.$disconnect();
});

describe("consumeRateLimit", () => {
  it("allows max hits, refuses the next, and resets after the window", async () => {
    const subject = uniq("rl-test");
    const rule = RATE_LIMITS.otp_email;

    for (let i = 0; i < rule.max; i++) {
      await expect(consumeRateLimit("otp_email", subject)).resolves.toBeUndefined();
    }
    await expect(consumeRateLimit("otp_email", subject)).rejects.toMatchObject({ code: "RATE_LIMITED" });

    // Time travel: pretend the window started long ago.
    await db.rateLimit.update({
      where: { key: `otp_email:${subject}` },
      data: { windowStart: new Date(Date.now() - rule.windowMs - 1) },
    });
    await expect(consumeRateLimit("otp_email", subject)).resolves.toBeUndefined();
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: `otp_email:${subject}` } })).count).toBe(1);
  });

  it("counts concurrent hits exactly", async () => {
    const subject = uniq("rl-test");
    const rule = RATE_LIMITS.otp_email;

    const results = await Promise.allSettled(
      Array.from({ length: rule.max + 3 }, () => consumeRateLimit("otp_email", subject)),
    );
    const refused = results.filter((r) => r.status === "rejected").length;
    expect(refused).toBe(3);
  });

  it("keeps subjects and actions separate", async () => {
    const a = uniq("rl-test");
    const b = uniq("rl-test");
    for (let i = 0; i < RATE_LIMITS.otp_email.max; i++) await consumeRateLimit("otp_email", a);
    await expect(consumeRateLimit("otp_email", b)).resolves.toBeUndefined();
    await expect(consumeRateLimit("otp_verify", a)).resolves.toBeUndefined();
  });

  it("prunes only long-dead rows", async () => {
    const subject = uniq("rl-test");
    await consumeRateLimit("message_send", subject);
    await db.rateLimit.update({
      where: { key: `message_send:${subject}` },
      data: { windowStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });
    await pruneRateLimits();
    expect(await db.rateLimit.findUnique({ where: { key: `message_send:${subject}` } })).toBeNull();
  });
});
