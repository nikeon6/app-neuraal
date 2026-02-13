import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/topics/RebuildTopicEmbedding", () => ({
  RebuildTopicEmbedding: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

vi.mock("@/infrastructure/persistence/PrismaTopicRepository", () => ({
  PrismaTopicRepository: class {},
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

describe("POST /api/topics/[id]/embedding/rebuild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/topics/t1/embedding/rebuild",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(401);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest(
      "http://localhost:3000/api/topics/t1/embedding/rebuild",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ rebuilt: true }));
    const req = new NextRequest(
      "http://localhost:3000/api/topics/t1/embedding/rebuild",
      {
        method: "POST",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
  });
});
