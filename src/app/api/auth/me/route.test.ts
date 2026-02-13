import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/auth/GetMe", () => ({
  GetMe: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

import { GET } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns mapped error status from use case", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with user on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ id: "u1", email: "a@a.com" }));
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("u1");
  });
});
