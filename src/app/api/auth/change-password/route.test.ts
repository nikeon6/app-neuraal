import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  clearAuthCookies: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/auth/ChangePassword", () => ({
  ChangePassword: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
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

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({ cookieSecure: false });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword: "old", newPassword: "new" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when currentPassword is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ newPassword: "Password123!" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("maps use case errors to proper status codes", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(
      err("UNAUTHORIZED", "invalid current password"),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword123!",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 and clears cookies on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok(undefined));
    const req = new NextRequest(
      "http://localhost:3000/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword123!",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mocks.clearAuthCookies).toHaveBeenCalled();
  });
});
