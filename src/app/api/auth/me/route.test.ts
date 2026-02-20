import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  getMeExecute: vi.fn(),
  updatePhoneExecute: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));
vi.mock("@/application/use-cases/auth/GetMe", () => ({
  GetMe: class {
    execute(...args: unknown[]) {
      return mocks.getMeExecute(...args);
    }
  },
}));
vi.mock("@/application/use-cases/auth/UpdatePhoneNumber", () => ({
  UpdatePhoneNumber: class {
    execute(...args: unknown[]) {
      return mocks.updatePhoneExecute(...args);
    }
  },
}));

import { GET, PATCH } from "./route";

const URL_AUTH_ME = "http://localhost:3000/api/auth/me";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(URL_AUTH_ME);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns mapped error status from use case", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.getMeExecute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest(URL_AUTH_ME);
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with user on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.getMeExecute.mockResolvedValue(
      ok({ id: "u1", email: "a@a.com", phoneNumber: null }),
    );
    const req = new NextRequest(URL_AUTH_ME);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("u1");
  });
});

describe("PATCH /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(URL_AUTH_ME, {
      method: "PATCH",
      body: JSON.stringify({ phoneNumber: "+34612345678" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(URL_AUTH_ME, {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 on successful phone update", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.updatePhoneExecute.mockResolvedValue(
      ok({ phoneNumber: "+34612345678" }),
    );
    const req = new NextRequest(URL_AUTH_ME, {
      method: "PATCH",
      body: JSON.stringify({ phoneNumber: "+34612345678" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phoneNumber).toBe("+34612345678");
  });

  it("returns mapped error when use case fails", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.updatePhoneExecute.mockResolvedValue(
      err("VALIDATION_ERROR", "Invalid phone"),
    );
    const req = new NextRequest(URL_AUTH_ME, {
      method: "PATCH",
      body: JSON.stringify({ phoneNumber: "bad" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Invalid phone");
  });

  it("sends null when phoneNumber is undefined in body", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.updatePhoneExecute.mockResolvedValue(ok({ phoneNumber: null }));
    const req = new NextRequest(URL_AUTH_ME, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mocks.updatePhoneExecute).toHaveBeenCalledWith({
      userId: "u1",
      phoneNumber: null,
    });
  });
});
