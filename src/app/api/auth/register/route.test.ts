import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/RegisterUser", () => ({
  RegisterUser: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));
vi.mock("@/infrastructure/auth/AuthConfig", () => ({
  getAuthConfig: mocks.getAuthConfig,
}));
vi.mock("@/infrastructure/email/EmailConfig", () => ({
  getEmailConfig: () => {
    throw new Error("SMTP not configured");
  },
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({
      jwtSecret: "secret",
      accessTtlSeconds: 3600,
      refreshTtlDays: 7,
      verificationTtlHours: 24,
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email/password are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("maps duplicate error to 409", async () => {
    mocks.execute.mockResolvedValue(err("DUPLICATE_ERROR", "exists"));
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "Password123!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 201 with user and message on success (no auth cookies)", async () => {
    mocks.execute.mockResolvedValue(
      ok({
        user: { id: "u1", email: "a@a.com" },
        message: "Please check your email to verify your account",
      }),
    );
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com", password: "Password123!" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.user).toBeDefined();
    expect(json.message).toBeDefined();

    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeNull();
  });
});
