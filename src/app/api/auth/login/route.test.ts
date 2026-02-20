import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  setAuthCookies: vi.fn(),
  getAuthConfig: vi.fn(),
  check: vi.fn(),
  recordFailure: vi.fn(),
  recordSuccess: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/LoginUser", () => ({
  LoginUser: class {
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
vi.mock("@/infrastructure/auth/LoginRateLimiter", () => ({
  loginRateLimiter: {
    check: mocks.check,
    recordFailure: mocks.recordFailure,
    recordSuccess: mocks.recordSuccess,
  },
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({
      jwtSecret: "secret",
      accessTtlSeconds: 3600,
      refreshTtlDays: 7,
    });
    mocks.check.mockReturnValue({ allowed: true });
    mocks.recordFailure.mockReturnValue({
      allowed: true,
      remainingAttempts: 4,
    });
  });

  it("returns 429 when rate limit check blocks request", async () => {
    mocks.check.mockReturnValue({ allowed: false, retryAfterMs: 60_000 });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "x" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 and remaining-attempts header on unauthorized", async () => {
    mocks.execute.mockResolvedValue(err("UNAUTHORIZED", "bad credentials"));
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "bad" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("returns 403 for EMAIL_NOT_VERIFIED error", async () => {
    mocks.execute.mockResolvedValue(
      err("EMAIL_NOT_VERIFIED", "Please verify your email"),
    );
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "Password123!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("returns 200 and sets cookies on success", async () => {
    mocks.execute.mockResolvedValue(
      ok({
        user: { id: "u1", email: "a@a.com" },
        tokens: { accessToken: "a", refreshToken: "r" },
      }),
    );
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "Password123!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.recordSuccess).toHaveBeenCalled();
    expect(mocks.setAuthCookies).toHaveBeenCalled();
  });
});
