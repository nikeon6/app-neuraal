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
    execute(...args: unknown[]) {
      return mocks.guardExecute(...args);
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
    mocks.guardExecute.mockResolvedValue(ok({}));
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
