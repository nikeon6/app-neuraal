import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/VerifyEmail", () => ({
  VerifyEmail: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));
vi.mock("@/infrastructure/auth/AuthConfig", () => ({
  getAuthConfig: mocks.getAuthConfig,
}));

import { GET } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({
      appBaseUrl: "http://localhost:3000",
    });
  });

  it("should redirect to /login?verified=true on success", async () => {
    mocks.execute.mockResolvedValue(ok({ ok: true }));
    const req = new NextRequest(
      "http://localhost:3000/api/auth/verify-email?token=valid-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?verified=true");
  });

  it("should redirect with error for invalid token", async () => {
    mocks.execute.mockResolvedValue(
      err("UNAUTHORIZED", "Invalid or expired verification token"),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/auth/verify-email?token=bad-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("verify-error=");
  });

  it("should return 400 if token query param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/verify-email");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
