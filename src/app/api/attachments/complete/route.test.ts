import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    attachment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { POST } from "./route";

function createRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/attachments/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/attachments/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest({ attachmentId: "attach-123" });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 404 when attachment does not exist", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue(null);

    const request = createRequest(
      { attachmentId: "attach-123" },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it("should return 200 with ready attachment on success", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue({
      id: "attach-123",
      userId: "user-123",
      entryId: "entry-123",
      storageKey: "attachments/user-123/test.pdf",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.attachment.update).mockResolvedValue({
      id: "attach-123",
      userId: "user-123",
      entryId: "entry-123",
      storageKey: "attachments/user-123/test.pdf",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      { attachmentId: "attach-123" },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.attachment.status).toBe("ready");
  });

  it("should return 404 when attachment belongs to another user", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue({
      id: "attach-123",
      userId: "user-456",
      entryId: "entry-123",
      storageKey: "attachments/user-456/test.pdf",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      { attachmentId: "attach-123" },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(404);
  });
});
