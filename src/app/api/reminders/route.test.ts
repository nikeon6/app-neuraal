import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
  guardExecute: vi.fn(),
  consumeExecute: vi.fn(),
  countPendingWhatsapp: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/reminders/CreateReminder", () => ({
  CreateReminder: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));
vi.mock("@/application/use-cases/ai/GuardAiAction", () => ({
  GuardAiAction: class {
    private readonly checker: {
      countActiveByUserId: (userId: string) => Promise<number>;
    };

    constructor(checker: {
      countActiveByUserId: (userId: string) => Promise<number>;
    }) {
      this.checker = checker;
    }

    execute(...args: unknown[]) {
      return mocks.guardExecute(this.checker, ...args);
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
vi.mock("@/infrastructure/queue/BullMQAdapter", () => ({
  BullMQAdapter: class {
    close(...args: unknown[]) {
      return mocks.close(...args);
    }
  },
}));
vi.mock("@/infrastructure/config/AiGuardrailsConfig", () => ({
  getAiGuardrailsConfig: () => ({
    reminderWhatsapp: {
      maxActivePerUser: 1,
      maxInputChars: 500,
      rateLimitPerMinute: 20,
      monthlyQuotaRequests: 100,
    },
    rateLimitPrefix: "test",
  }),
}));
vi.mock("@/infrastructure/persistence/PrismaReminderRepository", () => ({
  PrismaReminderRepository: class {
    countPendingWhatsappByUserId(...args: unknown[]) {
      return mocks.countPendingWhatsapp(...args);
    }
  },
}));
vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {
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

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardExecute.mockImplementation(async (checker) => {
      await checker.countActiveByUserId("u1");
      return ok({});
    });
    mocks.consumeExecute.mockResolvedValue(ok(undefined));
    mocks.countPendingWhatsapp.mockResolvedValue(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      body: JSON.stringify({ entryId: "e1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "entry missing"));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "email",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(mocks.close).toHaveBeenCalled();
  });

  it("maps CONFLICT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("CONFLICT", "duplicate"));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "email",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 201 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ id: "r1" }));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "email",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reminder.id).toBe("r1");
  });

  it("returns 429 when whatsapp guard rate limits", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("RATE_LIMITED", "too many"));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "whatsapp",
        message: "hola",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("returns 403 when whatsapp guard quota is exceeded", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("QUOTA_EXCEEDED", "quota"));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "whatsapp",
        message: "hola",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 409 when whatsapp guard hits concurrency limit", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.guardExecute.mockResolvedValue(err("CONCURRENCY_LIMIT", "busy"));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "whatsapp",
        message: "hola",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("creates reminder for whatsapp when guard allows request", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ id: "wa1" }));
    const req = new NextRequest("http://localhost:3000/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: "e1",
        scheduledAt: "2026-02-20T10:00:00.000Z",
        channel: "whatsapp",
        message: "hola",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mocks.countPendingWhatsapp).toHaveBeenCalledWith("u1");
    expect(mocks.consumeExecute).toHaveBeenCalledWith({
      userId: "u1",
      action: "REMINDER_WHATSAPP",
    });
  });
});
