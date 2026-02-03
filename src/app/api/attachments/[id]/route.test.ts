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

// Mock S3ObjectStorage
const deletedKeys: string[] = [];
vi.mock("@/infrastructure/storage/S3ObjectStorage", () => ({
  S3ObjectStorage: class {
    async deleteObject(storageKey: string) {
      deletedKeys.push(storageKey);
    }
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { DELETE } from "./route";

function createRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/attachments/attach-123", {
    method: "DELETE",
    headers: {
      ...headers,
    },
  });
}

const createContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("DELETE /api/attachments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedKeys.length = 0;
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest();
    const response = await DELETE(request, createContext("attach-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when attachment does not exist", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue(null);

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await DELETE(request, createContext("attach-123"));

    expect(response.status).toBe(404);
  });

  it("should return 204 on successful deletion", async () => {
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
    vi.mocked(prisma.attachment.update).mockResolvedValue({
      id: "attach-123",
      userId: "user-123",
      entryId: "entry-123",
      storageKey: "attachments/user-123/test.pdf",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
      status: "deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await DELETE(request, createContext("attach-123"));

    expect(response.status).toBe(204);
    expect(deletedKeys).toContain("attachments/user-123/test.pdf");
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
    const response = await DELETE(request, createContext("attach-123"));

    expect(response.status).toBe(404);
    expect(deletedKeys).toHaveLength(0);
  });

  it("should return 404 for already deleted attachment", async () => {
    vi.mocked(prisma.attachment.findUnique).mockResolvedValue({
      id: "attach-123",
      userId: "user-123",
      entryId: "entry-123",
      storageKey: "attachments/user-123/test.pdf",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
      status: "deleted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest({ "x-user-id": "user-123" });
    const response = await DELETE(request, createContext("attach-123"));

    expect(response.status).toBe(404);
  });
});
