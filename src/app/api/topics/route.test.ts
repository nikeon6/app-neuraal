import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client to avoid database connection
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    topic: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { GET, POST } from "./route";

// Helper to create mock request
function createRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const url = "http://localhost:3000/api/topics";
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

describe("GET /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("GET");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 when x-user-id header is empty", async () => {
    const request = createRequest("GET", undefined, { "x-user-id": "" });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return 401 when x-user-id header is whitespace", async () => {
    const request = createRequest("GET", undefined, { "x-user-id": "   " });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return 200 with topics array on success", async () => {
    const mockTopics = [
      {
        id: "topic-1",
        userId: "user-123",
        name: "Work",
        color: "#3b82f6",
        createdAt: new Date("2026-01-29T10:00:00Z"),
        updatedAt: new Date("2026-01-29T10:00:00Z"),
      },
      {
        id: "topic-2",
        userId: "user-123",
        name: "Health",
        color: "#22c55e",
        createdAt: new Date("2026-01-29T11:00:00Z"),
        updatedAt: new Date("2026-01-29T11:00:00Z"),
      },
    ];

    vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics);

    const request = createRequest("GET", undefined, {
      "x-user-id": "user-123",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.topics).toHaveLength(2);
    expect(data.topics[0].name).toBe("Work");
    expect(data.topics[1].name).toBe("Health");
  });

  it("should return empty array when user has no topics", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);

    const request = createRequest("GET", undefined, {
      "x-user-id": "user-123",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.topics).toEqual([]);
  });
});

describe("POST /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("POST", { name: "Work", color: "#3b82f6" });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 201 on successful topic creation", async () => {
    // No existing topics
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);
    vi.mocked(prisma.topic.create).mockResolvedValue({
      id: "topic-new",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });

    const request = createRequest(
      "POST",
      { name: "Work", color: "#3b82f6" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.topic.name).toBe("Work");
    expect(data.topic.color).toBe("#3b82f6");
    expect(data.topic.userId).toBe("user-123");
  });

  it("should return 400 when name is missing", async () => {
    const request = createRequest(
      "POST",
      { color: "#3b82f6" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when color is missing", async () => {
    const request = createRequest(
      "POST",
      { name: "Work" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 when color is invalid format", async () => {
    // No existing topics
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);

    const request = createRequest(
      "POST",
      { name: "Work", color: "invalid" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("color");
  });

  it("should return 400 when color is short hex (#RGB)", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);

    const request = createRequest(
      "POST",
      { name: "Work", color: "#fff" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 409 when topic already exists (case-insensitive)", async () => {
    // Existing topic with same name (different case)
    vi.mocked(prisma.topic.findMany).mockResolvedValue([
      {
        id: "topic-existing",
        userId: "user-123",
        name: "Work",
        color: "#3b82f6",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const request = createRequest(
      "POST",
      { name: "WORK", color: "#ef4444" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe("DUPLICATE_ERROR");
  });

  it("should return 400 when name is empty", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);

    const request = createRequest(
      "POST",
      { name: "", color: "#3b82f6" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 when name is whitespace only", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);

    const request = createRequest(
      "POST",
      { name: "   ", color: "#3b82f6" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should normalize color to lowercase", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);
    vi.mocked(prisma.topic.create).mockResolvedValue({
      id: "topic-new",
      userId: "user-123",
      name: "Work",
      color: "#aabbcc",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "POST",
      { name: "Work", color: "#AABBCC" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.topic.color).toBe("#aabbcc");
  });

  it("should trim name", async () => {
    vi.mocked(prisma.topic.findMany).mockResolvedValue([]);
    vi.mocked(prisma.topic.create).mockResolvedValue({
      id: "topic-new",
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "POST",
      { name: "  Work  ", color: "#3b82f6" },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.topic.name).toBe("Work");
  });
});
