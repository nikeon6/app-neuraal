import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    entry: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { GET, POST } from "./route";

// Helper to create mock request
function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
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

describe("GET /api/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries?date=2026-01-29",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return 400 when date query param is missing", async () => {
    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries",
      undefined,
      { "x-user-id": "user-123" },
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 when date format is invalid", async () => {
    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries?date=29-01-2026",
      undefined,
      { "x-user-id": "user-123" },
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("should return 200 with entries for valid date", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      {
        id: "entry-1",
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: { text: "content" },
        topicId: null,
        completed: false,
        version: 1,
        createdAt: new Date("2026-01-29T10:00:00Z"),
        updatedAt: new Date("2026-01-29T10:00:00Z"),
      },
    ]);

    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries?date=2026-01-29",
      undefined,
      { "x-user-id": "user-123" },
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].title).toBe("My Task");
  });

  it("should return empty array when no entries", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([]);

    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries?date=2026-01-29",
      undefined,
      { "x-user-id": "user-123" },
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entries).toHaveLength(0);
  });

  it("should filter entries by userId from repository", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([]);

    const request = createRequest(
      "GET",
      "http://localhost:3000/api/entries?date=2026-01-29",
      undefined,
      { "x-user-id": "user-123" },
    );
    await GET(request);

    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123", date: "2026-01-29" },
      }),
    );
  });
});

describe("POST /api/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("POST", "http://localhost:3000/api/entries", {
      date: "2026-01-29",
      type: "task",
      title: "My Task",
      content: {},
      completed: false,
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 201 on successful task creation", async () => {
    vi.mocked(prisma.entry.create).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "My Task",
      content: { text: "content" },
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });

    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: { text: "content" },
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.entry.type).toBe("task");
    expect(data.entry.completed).toBe(false);
  });

  it("should return 201 on successful note creation", async () => {
    vi.mocked(prisma.entry.create).mockResolvedValue({
      id: "entry-456",
      userId: "user-123",
      date: "2026-01-29",
      type: "note",
      title: "My Note",
      content: {},
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });

    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "note",
        title: "My Note",
        content: {},
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.entry.type).toBe("note");
    expect(data.entry.completed).toBeNull();
  });

  it("should return 400 for invalid date format", async () => {
    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "29-01-2026",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid type", async () => {
    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "event",
        title: "My Event",
        content: {},
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 when completed is set on note", async () => {
    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "note",
        title: "My Note",
        content: {},
        completed: true,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain("completed");
  });

  it("should return 400 for non-object content", async () => {
    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: "string content",
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should return 400 for title too long", async () => {
    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "task",
        title: "a".repeat(121),
        content: {},
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("should create entry with topicId", async () => {
    vi.mocked(prisma.entry.create).mockResolvedValue({
      id: "entry-789",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "My Task",
      content: {},
      topicId: "topic-456",
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });

    const request = createRequest(
      "POST",
      "http://localhost:3000/api/entries",
      {
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        topicId: "topic-456",
        completed: false,
      },
      { "x-user-id": "user-123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.entry.topicId).toBe("topic-456");
  });
});
