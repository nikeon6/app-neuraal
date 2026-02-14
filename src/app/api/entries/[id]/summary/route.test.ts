import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  findById: vi.fn(),
  clearSummary: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {
    findById(...args: unknown[]) {
      return mocks.findById(...args);
    }
    clearSummary(...args: unknown[]) {
      return mocks.clearSummary(...args);
    }
  },
}));

import { DELETE } from "./route";

const URL_ENTRIES_E1_SUMMARY = "http://localhost:3000/api/entries/e1/summary";

describe("DELETE /api/entries/[id]/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(URL_ENTRIES_E1_SUMMARY, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry does not exist", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.findById.mockResolvedValue(null);
    const req = new NextRequest(URL_ENTRIES_E1_SUMMARY, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 204 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.findById.mockResolvedValue({ id: "e1", userId: "u1" });
    const req = new NextRequest(URL_ENTRIES_E1_SUMMARY, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(204);
    expect(mocks.clearSummary).toHaveBeenCalledWith("e1");
  });
});
