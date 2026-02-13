import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  entryFindById: vi.fn(),
  guardExecute: vi.fn(),
  summaryExecute: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {
    findById(...args: unknown[]) {
      return mocks.entryFindById(...args);
    }
  },
}));

vi.mock("@/application/use-cases/ai/GuardAiAction", () => ({
  GuardAiAction: class {
    execute(...args: unknown[]) {
      return mocks.guardExecute(...args);
    }
  },
}));

vi.mock("@/application/use-cases/summaries/RequestEntrySummary", () => ({
  RequestEntrySummary: class {
    execute(...args: unknown[]) {
      return mocks.summaryExecute(...args);
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

vi.mock("@/infrastructure/persistence/PrismaNotificationRepository", () => ({
  PrismaNotificationRepository: class {
    noop() {}
  },
}));
vi.mock("@/infrastructure/persistence/PrismaSummaryRequestRepository", () => ({
  PrismaSummaryRequestRepository: class {
    noop() {}
  },
}));
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
    summary: {
      maxActivePerUser: 1,
      maxActivePerEntry: 1,
      maxInputChars: 1000,
      rateLimitPerMinute: 60,
      rateLimitPerHour: 200,
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

describe("POST /api/entries/[id]/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardExecute.mockResolvedValue(ok({ truncated: false }));
    mocks.summaryExecute.mockResolvedValue(
      ok({ requestId: "r1", notificationId: "n1" }),
    );
    mocks.close.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/summarize",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry is not owned or missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.entryFindById.mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/summarize",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("maps guard QUOTA_EXCEEDED to 403", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.entryFindById.mockResolvedValue({
      userId: "u1",
      title: { toString: () => "t" },
      content: { toJSON: () => ({ type: "doc", content: [] }) },
    });
    mocks.guardExecute.mockResolvedValue(err("QUOTA_EXCEEDED", "quota"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/summarize",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 202 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.entryFindById.mockResolvedValue({
      userId: "u1",
      title: { toString: () => "title" },
      content: {
        toJSON: () => ({
          type: "doc",
          content: [{ type: "text", text: "hello" }],
        }),
      },
    });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/summarize",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requestId).toBe("r1");
  });
});
