import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  listExecute: vi.fn(),
  createExecute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/stickies/ListStickies", () => ({
  ListStickies: class {
    execute(...args: unknown[]) {
      return mocks.listExecute(...args);
    }
  },
}));

vi.mock("@/application/use-cases/stickies/CreateSticky", () => ({
  CreateSticky: class {
    execute(...args: unknown[]) {
      return mocks.createExecute(...args);
    }
  },
}));

import { GET, POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("/api/stickies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/stickies");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("GET should return 200 with stickies", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.listExecute.mockResolvedValue(ok([{ id: "s1", title: "Sticky 1" }]));
    const req = new NextRequest("http://localhost:3000/api/stickies");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stickies).toHaveLength(1);
  });

  it("POST should return 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    const req = new NextRequest("http://localhost:3000/api/stickies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST should return 400 when title/content are missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    const req = new NextRequest("http://localhost:3000/api/stickies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "only-title" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST should return 400 when use case fails", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.createExecute.mockResolvedValue(err("VALIDATION_ERROR", "bad"));
    const req = new NextRequest("http://localhost:3000/api/stickies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t", content: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST should return 201 with sticky", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.createExecute.mockResolvedValue(
      ok({ id: "s1", title: "t", content: {} }),
    );
    const req = new NextRequest("http://localhost:3000/api/stickies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t", content: {}, columnIndex: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sticky.id).toBe("s1");
  });
});
