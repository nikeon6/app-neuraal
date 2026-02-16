import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/topics/AutoAssignTopicToEntry", () => ({
  AutoAssignTopicToEntry: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaTopicRepository", () => ({
  PrismaTopicRepository: class {},
}));
vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {},
}));
vi.mock("@/infrastructure/embedding/OllamaEmbeddingProvider", () => ({
  OllamaEmbeddingProvider: class {},
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/entries/[id]/auto-topic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/auto-topic",
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when threshold is out of range", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/auto-topic",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: 2 }),
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/auto-topic",
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ assigned: true, topicId: "t1" }));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/auto-topic",
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
  });
});
