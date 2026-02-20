import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/ConfirmPasswordReset", () => ({
  ConfirmPasswordReset: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ newPassword: "Password123!" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-1" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("maps use case errors to 400/401/500", async () => {
    mocks.execute.mockResolvedValueOnce(
      err("VALIDATION_ERROR", "bad password"),
    );
    const validationReq = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-1", newPassword: "bad" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const validationRes = await POST(validationReq);
    expect(validationRes.status).toBe(400);

    mocks.execute.mockResolvedValueOnce(err("UNAUTHORIZED", "expired"));
    const unauthorizedReq = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-1", newPassword: "Password123!" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const unauthorizedRes = await POST(unauthorizedReq);
    expect(unauthorizedRes.status).toBe(401);

    mocks.execute.mockResolvedValueOnce(err("INTERNAL_ERROR", "boom"));
    const internalReq = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-1", newPassword: "Password123!" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const internalRes = await POST(internalReq);
    expect(internalRes.status).toBe(500);
  });

  it("returns 200 on success", async () => {
    mocks.execute.mockResolvedValue(ok({ ok: true }));
    const req = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-1", newPassword: "Password123!" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
