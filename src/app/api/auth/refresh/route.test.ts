import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  setAuthCookies: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/RefreshSession", () => ({
  RefreshSession: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));
vi.mock("@/infrastructure/auth/AuthCookies", () => ({
  setAuthCookies: mocks.setAuthCookies,
}));
vi.mock("@/infrastructure/auth/AuthConfig", () => ({
  getAuthConfig: mocks.getAuthConfig,
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({
      jwtSecret: "secret",
      accessTtlSeconds: 3600,
      refreshTtlDays: 7,
    });
  });

  it("returns 401 when refresh token cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when use case fails", async () => {
    mocks.execute.mockResolvedValue(err("UNAUTHORIZED", "invalid token"));
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refresh_token=r1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and sets cookies on success", async () => {
    mocks.execute.mockResolvedValue(
      ok({ tokens: { accessToken: "a", refreshToken: "r2" } }),
    );
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refresh_token=r1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.setAuthCookies).toHaveBeenCalled();
  });
});
