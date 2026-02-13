import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/RequestPasswordReset", () => ({
  RequestPasswordReset: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
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

describe("POST /api/auth/recover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({ resetTtlMinutes: 30 });
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/recover", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for validation error from use case", async () => {
    mocks.execute.mockResolvedValue(err("VALIDATION_ERROR", "invalid email"));
    const req = new NextRequest("http://localhost:3000/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({ email: "bad" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 for non-validation error from use case", async () => {
    mocks.execute.mockResolvedValue(err("INTERNAL_ERROR", "boom"));
    const req = new NextRequest("http://localhost:3000/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 on success", async () => {
    mocks.execute.mockResolvedValue(ok({ ok: true }));
    const req = new NextRequest("http://localhost:3000/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({ email: "a@a.com" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
