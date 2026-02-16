import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  reorderExecute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/stickies/ReorderStickies", () => ({
  ReorderStickies: class {
    execute(...args: unknown[]) {
      return mocks.reorderExecute(...args);
    }
  },
}));

import { PATCH } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("PATCH /api/stickies/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/stickies/reorder", {
      method: "PATCH",
      body: JSON.stringify({ items: [] }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    const req = new NextRequest("http://localhost:3000/api/stickies/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when items is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    const req = new NextRequest("http://localhost:3000/api/stickies/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when use case fails", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.reorderExecute.mockResolvedValue(err("VALIDATION_ERROR", "bad"));
    const req = new NextRequest("http://localhost:3000/api/stickies/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "s1", sortOrder: 0, columnIndex: 0 }],
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("should return 204 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.reorderExecute.mockResolvedValue(ok(undefined));
    const req = new NextRequest("http://localhost:3000/api/stickies/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "s1", sortOrder: 0, columnIndex: 0 }],
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(204);
  });
});
