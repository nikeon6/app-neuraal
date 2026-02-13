import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  updateExecute: vi.fn(),
  deleteExecute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/stickies/UpdateSticky", () => ({
  UpdateSticky: class {
    execute(...args: unknown[]) {
      return mocks.updateExecute(...args);
    }
  },
}));

vi.mock("@/application/use-cases/stickies/DeleteSticky", () => ({
  DeleteSticky: class {
    execute(...args: unknown[]) {
      return mocks.deleteExecute(...args);
    }
  },
}));

import { PATCH, DELETE } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("/api/stickies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH should return 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "PATCH",
      body: JSON.stringify({ version: 1 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(401);
  });

  it("PATCH should return 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(400);
  });

  it("PATCH should map NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.updateExecute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, title: "x" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("PATCH should map CONFLICT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.updateExecute.mockResolvedValue(err("CONFLICT", "version"));
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, title: "x" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(409);
  });

  it("DELETE should return 404 when sticky is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.deleteExecute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(404);
  });

  it("DELETE should return 204 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "user-1" });
    mocks.deleteExecute.mockResolvedValue(ok(undefined));
    const req = new NextRequest("http://localhost:3000/api/stickies/s1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(204);
  });
});
