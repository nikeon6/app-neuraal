import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  guardExecute: vi.fn(),
  extractExecute: vi.fn(),
  entryFindById: vi.fn(),
  entryUpdateContent: vi.fn(),
  consumeExecute: vi.fn(),
  aiAddLedger: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/ai/GuardAiAction", () => ({
  GuardAiAction: class {
    private readonly checker: { countActiveByUserId: () => Promise<number> };

    constructor(checker: { countActiveByUserId: () => Promise<number> }) {
      this.checker = checker;
    }

    execute(...args: unknown[]) {
      return mocks.guardExecute(this.checker, ...args);
    }
  },
}));

vi.mock("@/application/use-cases/ocr/ExtractImageText", () => ({
  ExtractImageText: class {
    execute(...args: unknown[]) {
      return mocks.extractExecute(...args);
    }
  },
}));

vi.mock("@/application/use-cases/ai/ConsumeAiRequest", () => ({
  ConsumeAiRequest: class {
    execute(...args: unknown[]) {
      return mocks.consumeExecute(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {
    findById(...args: unknown[]) {
      return mocks.entryFindById(...args);
    }
    updateContent(...args: unknown[]) {
      return mocks.entryUpdateContent(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaAiUsageRepository", () => ({
  PrismaAiUsageRepository: class {
    addLedgerEntry(...args: unknown[]) {
      return mocks.aiAddLedger(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaAttachmentRepository", () => ({
  PrismaAttachmentRepository: class {
    noop() {}
  },
}));

vi.mock("@/infrastructure/storage/S3ObjectStorage", () => ({
  S3ObjectStorage: class {
    noop() {}
  },
}));

vi.mock("@/infrastructure/ocr/OllamaVisionProvider", () => ({
  OllamaVisionProvider: class {
    noop() {}
  },
  PROMPT_SCAN_TEXT: "scan",
  PROMPT_DESCRIBE: "describe",
}));

vi.mock("@/infrastructure/config/AiGuardrailsConfig", () => ({
  getAiGuardrailsConfig: () => ({
    ocrImage: {
      maxActivePerUser: 1,
      maxInputBytes: 10_000,
      rateLimitPerMinute: 60,
      monthlyQuotaRequests: 100,
    },
    rateLimitPrefix: "test",
  }),
}));

vi.mock("@/infrastructure/redis/RedisClient", () => ({
  getRedisConnection: vi.fn(),
}));

vi.mock("@/infrastructure/redis/RedisRateLimiter", () => ({
  RedisRateLimiter: class {
    noop() {}
  },
}));

vi.mock("@/infrastructure/redis/RedisConcurrencyLimiter", () => ({
  RedisConcurrencyLimiter: class {
    acquire(...args: unknown[]) {
      return mocks.acquire(...args);
    }
    release(...args: unknown[]) {
      return mocks.release(...args);
    }
  },
}));

vi.mock("@/infrastructure/auth/SystemClock", () => ({
  SystemClock: class {
    noop() {}
  },
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/entries/[id]/ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acquire.mockResolvedValue({ acquired: true, current: 1 });
    mocks.release.mockResolvedValue(undefined);
    mocks.guardExecute.mockImplementation(async (checker) => {
      await checker.countActiveByUserId();
      return ok({});
    });
    mocks.consumeExecute.mockResolvedValue(ok({}));
    mocks.aiAddLedger.mockResolvedValue(undefined);
    mocks.entryFindById.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps guard RATE_LIMITED to 429", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("RATE_LIMITED", "too many"));
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(429);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("maps guard QUOTA_EXCEEDED to 403", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("QUOTA_EXCEEDED", "quota"));
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("maps guard CONCURRENCY_LIMIT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockImplementation(async (checker) => {
      const active = await checker.countActiveByUserId();
      if (active >= 1) return err("CONCURRENCY_LIMIT", "busy");
      return ok({});
    });
    mocks.acquire.mockResolvedValue({ acquired: false, current: 1 });
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(409);
    expect(mocks.acquire).toHaveBeenCalled();
  });

  it("maps guard INPUT_TOO_LARGE to 400", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("INPUT_TOO_LARGE", "too big"));
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when attachmentId is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps use-case NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.extractExecute.mockResolvedValue(err("NOT_FOUND", "not found"));
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("maps use-case INTERNAL_ERROR to 502", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.extractExecute.mockResolvedValue(err("INTERNAL_ERROR", "upstream"));
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(502);
  });

  it("falls back to scan mode for unknown mode values", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.extractExecute.mockResolvedValue(
      ok({ attachmentId: "a1", extractedText: "text" }),
    );
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1", mode: "random" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
    expect(mocks.extractExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "scan" }),
    );
  });

  it("persists vision result and supports describe mode", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.extractExecute.mockResolvedValue(
      ok({ attachmentId: "a1", extractedText: "detected" }),
    );
    mocks.entryFindById.mockResolvedValue({
      content: {
        toJSON: () => ({
          type: "doc",
          content: [
            {
              type: "image",
              attrs: { attachmentId: "a1", alt: "img" },
            },
          ],
        }),
      },
    });
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1", mode: "describe" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
    expect(mocks.extractExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "describe" }),
    );
    expect(mocks.entryUpdateContent).toHaveBeenCalledTimes(1);
    const updatedDoc = mocks.entryUpdateContent.mock.calls[0]?.[1] as {
      content: Array<{ attrs: Record<string, unknown> }>;
    };
    expect(updatedDoc.content[0]?.attrs.visionResult).toBe("detected");
    expect(updatedDoc.content[0]?.attrs.visionMode).toBe("describe");
  });

  it("returns 200 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.extractExecute.mockResolvedValue(
      ok({ attachmentId: "a1", extractedText: "hello" }),
    );
    const req = new NextRequest("http://localhost:3000/api/entries/e1/ocr", {
      method: "POST",
      body: JSON.stringify({ attachmentId: "a1", mode: "scan" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attachmentId).toBe("a1");
    expect(body.mode).toBe("scan");
  });
});
