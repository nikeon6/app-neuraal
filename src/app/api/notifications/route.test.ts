import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/notifications/ListNotifications", () => ({
  ListNotifications: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

import { GET } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(message: string) {
  return { isErr: () => true, error: { code: "VALIDATION_ERROR", message } };
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when use case fails", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("bad since"));
    const req = new NextRequest(
      "http://localhost:3000/api/notifications?since=invalid",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with notifications", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok([{ id: "n1", type: "SUMMARY_DONE" }]));
    const req = new NextRequest("http://localhost:3000/api/notifications");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
  });
});
