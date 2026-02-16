import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    attachment: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock S3ObjectStorage
vi.mock("@/infrastructure/storage/S3ObjectStorage", () => ({
  S3ObjectStorage: class {
    async getPresignedGetUrl(storageKey: string) {
      return `https://fake-s3.example.com/get/${storageKey}`;
    }
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { GET } from "./route";

function createRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/attachments/attach-123/download",
    {
      method: "GET",
      headers: {
        ...headers,
      },
    },
  );
}

const createContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("GET /api/attachments/:id/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest();
    const response = await GET(request, createContext("attach-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when attachment does not exist", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue(null);

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await GET(request, createContext("attach-123"));

    expect(response.status).toBe(404);
  });

  it("should return 200 with presigned GET URL for ready attachment", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue({
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

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await GET(request, createContext("attach-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.presignedGetUrl).toContain("https://");
  });

  it("should return 404 for pending attachment", async () => {
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

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await GET(request, createContext("attach-123"));

    expect(response.status).toBe(404);
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
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await GET(request, createContext("attach-123"));

    expect(response.status).toBe(404);
  });
});
