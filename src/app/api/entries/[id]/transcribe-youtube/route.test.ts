import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  guardExecute: vi.fn(),
  transcriptExecute: vi.fn(),
  close: vi.fn(),
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

vi.mock("@/application/use-cases/transcripts/RequestEntryTranscript", () => ({
  RequestEntryTranscript: class {
    execute(...args: unknown[]) {
      return mocks.transcriptExecute(...args);
    }
  },
}));

vi.mock("@/infrastructure/queue/BullMQAdapter", () => ({
  BullMQAdapter: class {
    close(...args: unknown[]) {
      return mocks.close(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {
    noop() {}
  },
}));
vi.mock("@/infrastructure/persistence/PrismaNotificationRepository", () => ({
  PrismaNotificationRepository: class {
    noop() {}
  },
}));
vi.mock(
  "@/infrastructure/persistence/PrismaTranscriptRequestRepository",
  () => ({
    PrismaTranscriptRequestRepository: class {
      noop() {}
    },
  }),
);
vi.mock("@/infrastructure/persistence/PrismaAiUsageRepository", () => ({
  PrismaAiUsageRepository: class {
    noop() {}
  },
}));
vi.mock("@/infrastructure/redis/RedisClient", () => ({
  getRedisConnection: vi.fn(),
}));
vi.mock("@/infrastructure/redis/RedisRateLimiter", () => ({
  RedisRateLimiter: class {
    noop() {}
  },
}));
vi.mock("@/infrastructure/auth/SystemClock", () => ({
  SystemClock: class {
    noop() {}
  },
}));
vi.mock("@/infrastructure/config/AiGuardrailsConfig", () => ({
  getAiGuardrailsConfig: () => ({
    transcriptYoutube: {
      maxActivePerUser: 1,
      maxActivePerEntry: 1,
      maxInputChars: 1000,
      rateLimitPerMinute: 60,
      monthlyQuotaRequests: 100,
    },
    rateLimitPrefix: "test",
  }),
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/entries/[id]/transcribe-youtube", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardExecute.mockResolvedValue(ok({}));
    mocks.transcriptExecute.mockResolvedValue(
      ok({ requestId: "r1", notificationId: "n1" }),
    );
    mocks.close.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when url is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps guard RATE_LIMITED to 429", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("RATE_LIMITED", "limit"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(429);
  });

  it("maps guard QUOTA_EXCEEDED to 403", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("QUOTA_EXCEEDED", "quota"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("maps guard CONCURRENCY_LIMIT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("CONCURRENCY_LIMIT", "busy"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(409);
  });

  it("maps unknown guard error code to 400", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("INTERNAL_ERROR", "guard failed"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps use-case NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.transcriptExecute.mockResolvedValue(
      err("NOT_FOUND", "entry missing"),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("maps non-NOT_FOUND use-case errors to 400", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.transcriptExecute.mockResolvedValue(
      err("CONFLICT", "already queued"),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected exception", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.transcriptExecute.mockRejectedValue(new Error("network down"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(500);
  });

  it("returns 202 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcribe-youtube",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requestId).toBe("r1");
  });
});
