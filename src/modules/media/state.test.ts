import { describe, expect, it } from "vitest";
import { MAX_PORTFOLIO_ITEMS, STORAGE_KEY_SHAPE, checkUploadLimits, sniffMediaType } from "./state";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniffMediaType", () => {
  it("recognises the image formats by magic bytes", () => {
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mimeType).toBe("image/jpeg");
    expect(sniffMediaType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))?.mimeType).toBe("image/png");
    expect(sniffMediaType(bytes("GIF89a"))?.mimeType).toBe("image/gif");
    expect(sniffMediaType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))?.mimeType).toBe("image/webp");
  });

  it("recognises mp4, mov, webm and pdf", () => {
    expect(sniffMediaType(bytes(0, 0, 0, 0x18, "ftypisom"))?.mimeType).toBe("video/mp4");
    expect(sniffMediaType(bytes(0, 0, 0, 0x14, "ftypqt  "))?.mimeType).toBe("video/quicktime");
    expect(sniffMediaType(bytes(0x1a, 0x45, 0xdf, 0xa3))?.kind).toBe("VIDEO");
    expect(sniffMediaType(bytes("%PDF-1.7"))?.kind).toBe("PDF");
  });

  it("refuses anything that could carry script, whatever it claims to be", () => {
    expect(sniffMediaType(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffMediaType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffMediaType(new Uint8Array())).toBeNull();
  });
});

describe("checkUploadLimits", () => {
  const base = { usedBytes: 0, itemCount: 0, maxFileBytes: 1000, maxTotalBytes: 5000 };

  it("accepts a file within every cap", () => {
    expect(checkUploadLimits({ ...base, bytes: 500 })).toEqual({ ok: true });
  });

  it("refuses an oversized file", () => {
    expect(checkUploadLimits({ ...base, bytes: 1001 }).ok).toBe(false);
  });

  it("refuses when the user's total would be exceeded", () => {
    expect(checkUploadLimits({ ...base, bytes: 500, usedBytes: 4600 }).ok).toBe(false);
  });

  it("refuses when the portfolio is full", () => {
    expect(checkUploadLimits({ ...base, bytes: 1, itemCount: MAX_PORTFOLIO_ITEMS }).ok).toBe(false);
  });

  it("refuses an empty file", () => {
    expect(checkUploadLimits({ ...base, bytes: 0 }).ok).toBe(false);
  });
});

describe("STORAGE_KEY_SHAPE", () => {
  it("allows only a bare lowercase filename", () => {
    expect(STORAGE_KEY_SHAPE.test("a1b2c3.jpg")).toBe(true);
    expect(STORAGE_KEY_SHAPE.test("../etc/passwd")).toBe(false);
    expect(STORAGE_KEY_SHAPE.test("a/b.jpg")).toBe(false);
    expect(STORAGE_KEY_SHAPE.test(".env")).toBe(false);
  });
});
