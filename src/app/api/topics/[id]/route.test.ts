import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    topic: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    entry: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { PATCH, DELETE } from "./route";

// Helper to create mock request
function createRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const url = "http://localhost:3000/api/topics/topic-123";
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

// Context with params
const createContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("PATCH /api/topics/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("PATCH", { name: "Updated" });
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when topic does not exist", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue(null);

    const request = createRequest(
      "PATCH",
      { name: "Updated" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(404);
  });

  it("should return 404 when topic belongs to another user (ownership check)", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-456", // Different user
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { name: "Hacked" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(404);
    // Should not leak info that topic exists
    const data = await response.json();
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("should return 200 on successful name update", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);
    vi.mocked(prisma.topic.update).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Updated",
      color: "#3b82f6",
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { name: "Updated" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.topic.name).toBe("Updated");
  });

  it("should return 200 on successful color update", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.topic.update).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#ef4444",
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { color: "#ef4444" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.topic.color).toBe("#ef4444");
  });

  it("should return 400 when no fields to update", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest("PATCH", {}, { "x-user-id": "user-123" });
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when name is invalid", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { name: "" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(400);
  });

  it("should return 400 when color is invalid", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { color: "invalid" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(400);
  });

  it("should return 409 when name already exists", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.topic.findMany).mockResolvedValue([
      {
        id: "topic-456",
        userId: "user-123",
        name: "Health",
        color: "#22c55e",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const request = createRequest(
      "PATCH",
      { name: "Health" },
      { "x-user-id": "user-123" },
    );
    const response = await PATCH(request, createContext("topic-123"));

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/topics/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("DELETE");
    const response = await DELETE(request, createContext("topic-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when topic does not exist", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue(null);

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("topic-123"));

    expect(response.status).toBe(404);
  });

  it("should return 404 when topic belongs to another user (ownership check)", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-456", // Different user
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("topic-123"));

    expect(response.status).toBe(404);
    // Topic should NOT be deleted
    expect(prisma.topic.delete).not.toHaveBeenCalled();
  });

  it("should return 204 on successful deletion", async () => {
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.entry.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.topic.delete).mockResolvedValue({
      id: "topic-123",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("topic-123"));

    expect(response.status).toBe(204);
    expect(prisma.entry.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-123", topicId: "topic-123" },
      data: { topicId: null },
    });
    expect(prisma.topic.delete).toHaveBeenCalledWith({
      where: { id: "topic-123" },
    });
  });

  it("should return 400 when topicId is empty", async () => {
    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext(""));

    expect(response.status).toBe(400);
  });
});
