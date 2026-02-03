import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    entry: {
      findUnique: vi.fn(),
    },
    attachment: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

// Mock S3ObjectStorage
vi.mock("@/infrastructure/storage/S3ObjectStorage", () => ({
  S3ObjectStorage: class {
    async getPresignedPutUrl() {
      return "https://fake-s3.example.com/presigned-put";
    }
  },
}));

// Mock config
vi.mock("@/infrastructure/config/AttachmentConfig", () => ({
  getAttachmentConfig: vi.fn().mockReturnValue({
    maxEntryAttachmentSizeBytes: { toNumber: () => 20 * 1024 * 1024, greaterThan: () => false },
    maxUserStorageQuotaBytes: { toNumber: () => 1024 * 1024 * 1024, greaterThan: () => false },
  }),
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { POST } from "./route";

function createRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/attachments/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/attachments/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest({
      entryId: "entry-123",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 404 when entry does not exist", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);

    const request = createRequest(
      {
        entryId: "entry-123",
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it("should return 201 with presigned URL on success", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Test",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.attachment.aggregate).mockResolvedValue({
      _sum: { sizeBytes: 0 },
      _count: { _all: 0 },
      _avg: { sizeBytes: null },
      _min: { sizeBytes: null },
      _max: { sizeBytes: null },
    });
    vi.mocked(prisma.attachment.create).mockResolvedValue({
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

    const request = createRequest(
      {
        entryId: "entry-123",
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.attachment.status).toBe("pending");
    expect(data.presignedPutUrl).toContain("https://");
  });

  it("should return 400 for invalid mimeType", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Test",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      {
        entryId: "entry-123",
        filename: "test.pdf",
        mimeType: "invalid",
        sizeBytes: 1024,
        kind: "file",
      },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 for zero sizeBytes", async () => {
    const request = createRequest(
      {
        entryId: "entry-123",
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        kind: "file",
      },
      { "x-user-id": "user-123" }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
