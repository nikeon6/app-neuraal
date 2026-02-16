import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  executeByRefreshToken: vi.fn(),
  clearAuthCookies: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/auth/LogoutUser", () => ({
  LogoutUser: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
    executeByRefreshToken(...args: unknown[]) {
      return mocks.executeByRefreshToken(...args);
    }
  },
}));
vi.mock("@/infrastructure/auth/AuthCookies", () => ({
  clearAuthCookies: mocks.clearAuthCookies,
}));
vi.mock("@/infrastructure/auth/AuthConfig", () => ({
  getAuthConfig: mocks.getAuthConfig,
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({ cookieSecure: false });
  });

  it("returns 204 and revokes by user when access token is valid", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "refresh_token=r1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mocks.execute).toHaveBeenCalled();
    expect(mocks.clearAuthCookies).toHaveBeenCalled();
  });

  it("returns 204 and revokes by refresh token when access is invalid", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "refresh_token=r1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mocks.executeByRefreshToken).toHaveBeenCalledWith({
      refreshTokenRaw: "r1",
    });
  });
});
