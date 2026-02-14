import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/notifications/MarkNotificationRead", () => ({
  MarkNotificationRead: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

import { POST } from "./route";

const URL_NOTIFICATIONS_N1_READ =
  "http://localhost:3000/api/notifications/n1/read";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/notifications/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(URL_NOTIFICATIONS_N1_READ, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when notification is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest(URL_NOTIFICATIONS_N1_READ, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ success: true }));
    const req = new NextRequest(URL_NOTIFICATIONS_N1_READ, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
