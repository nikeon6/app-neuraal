import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/entries/ReorderEntries", () => ({
  ReorderEntries: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
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

describe("PATCH /api/entries/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/entries/reorder", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/entries/reorder", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-01-01" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 204 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok(undefined));
    const req = new NextRequest("http://localhost:3000/api/entries/reorder", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-01-01", orderedIds: ["e1", "e2"] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(204);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "entry missing"));
    const req = new NextRequest("http://localhost:3000/api/entries/reorder", {
      method: "PATCH",
      body: JSON.stringify({ date: "2026-01-01", orderedIds: ["e1"] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });
});
