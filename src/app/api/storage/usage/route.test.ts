import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  sumActiveBytesByUser: vi.fn(),
  getAttachmentConfig: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/infrastructure/persistence/PrismaAttachmentRepository", () => ({
  PrismaAttachmentRepository: class {
    sumActiveBytesByUser(...args: unknown[]) {
      return mocks.sumActiveBytesByUser(...args);
    }
  },
}));

vi.mock("@/infrastructure/config/AttachmentConfig", () => ({
  getAttachmentConfig: mocks.getAttachmentConfig,
}));

import { GET } from "./route";

describe("GET /api/storage/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAttachmentConfig.mockReturnValue({
      maxUserStorageQuotaBytes: { toNumber: () => 1_000_000 },
      maxEntryAttachmentSizeBytes: { toNumber: () => 10_000 },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/storage/usage");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns usage payload on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.sumActiveBytesByUser.mockResolvedValue(1234);
    const req = new NextRequest("http://localhost:3000/api/storage/usage");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usedBytes).toBe(1234);
    expect(body.maxUserStorageBytes).toBe(1_000_000);
  });
});
