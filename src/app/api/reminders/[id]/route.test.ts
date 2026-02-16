import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/reminders/UpdateReminder", () => ({
  UpdateReminder: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));
vi.mock("@/infrastructure/queue/BullMQAdapter", () => ({
  BullMQAdapter: class {
    close(...args: unknown[]) {
      return mocks.close(...args);
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

describe("PATCH /api/reminders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/reminders/r1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest("http://localhost:3000/api/reminders/r1", {
      method: "PATCH",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(400);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest("http://localhost:3000/api/reminders/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(404);
  });

  it("maps CONFLICT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("CONFLICT", "already processed"));
    const req = new NextRequest("http://localhost:3000/api/reminders/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 200 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(ok({ id: "r1", status: "canceled" }));
    const req = new NextRequest("http://localhost:3000/api/reminders/r1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reminder.id).toBe("r1");
    expect(mocks.close).toHaveBeenCalled();
  });
});
