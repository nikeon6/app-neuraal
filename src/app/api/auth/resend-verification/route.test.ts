import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/application/use-cases/auth/ResendVerificationEmail", () => ({
  ResendVerificationEmail: class {
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

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthConfig.mockReturnValue({
      verificationTtlHours: 24,
    });
  });

  it("should return 200 for valid email", async () => {
    mocks.execute.mockResolvedValue(ok({ ok: true }));
    const req = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("should return 400 for missing email", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
