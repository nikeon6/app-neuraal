import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma client
vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    entry: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/infrastructure/persistence/prisma";
import { PATCH, DELETE } from "./route";

// Helper to create mock request
function createRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const url = "http://localhost:3000/api/entries/entry-123";
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

describe("PATCH /api/entries/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("PATCH", { version: 1, title: "Updated" });
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when entry does not exist", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);

    const request = createRequest(
      "PATCH",
      { version: 1, title: "Updated" },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(404);
  });

  it("should return 404 when entry belongs to another user", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-456", // Different user
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, title: "Hacked" },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(404);
  });

  it("should return 409 when version does not match", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 2, // Current version
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, title: "Updated" }, // Stale version
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe("CONFLICT");
  });

  it("should return 200 on successful title update", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Original",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });
    vi.mocked(prisma.entry.update).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Updated",
      content: {},
      topicId: null,
      completed: false,
      version: 2,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, title: "Updated" },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entry.title).toBe("Updated");
    expect(data.entry.version).toBe(2);
  });

  it("should return 200 on successful content update", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: { original: true },
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });
    vi.mocked(prisma.entry.update).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: { updated: true },
      topicId: null,
      completed: false,
      version: 2,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, content: { updated: true } },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entry.content).toEqual({ updated: true });
  });

  it("should return 200 on successful completed update", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });
    vi.mocked(prisma.entry.update).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: true,
      version: 2,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, completed: true },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entry.completed).toBe(true);
  });

  it("should silently reset completed to null when set on note", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "note",
      title: "Note",
      content: {},
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.entry.update).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "note",
      title: "Note",
      content: {},
      topicId: null,
      completed: null,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, completed: true },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    // Domain now accepts completed on notes but resets to null
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entry.completed).toBeNull();
  });

  it("should return 400 when version is missing", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { title: "Updated" }, // No version
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(400);
  });

  it("should return 400 when no fields to update", async () => {
    const request = createRequest(
      "PATCH",
      { version: 1 }, // Only version, no fields
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(400);
  });

  it("should update topicId to null", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: "topic-456",
      completed: false,
      version: 1,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date("2026-01-29T10:00:00Z"),
    });
    vi.mocked(prisma.entry.update).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 2,
      createdAt: new Date("2026-01-29T10:00:00Z"),
      updatedAt: new Date(),
    });

    const request = createRequest(
      "PATCH",
      { version: 1, topicId: null },
      { "x-user-id": "user-123" }
    );
    const response = await PATCH(request, createContext("entry-123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.entry.topicId).toBeNull();
  });
});

describe("DELETE /api/entries/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when x-user-id header is missing", async () => {
    const request = createRequest("DELETE");
    const response = await DELETE(request, createContext("entry-123"));

    expect(response.status).toBe(401);
  });

  it("should return 404 when entry does not exist", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("entry-123"));

    expect(response.status).toBe(404);
  });

  it("should return 404 when entry belongs to another user", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-456", // Different user
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("entry-123"));

    expect(response.status).toBe(404);
    expect(prisma.entry.delete).not.toHaveBeenCalled();
  });

  it("should return 204 on successful deletion", async () => {
    vi.mocked(prisma.entry.findUnique).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.entry.delete).mockResolvedValue({
      id: "entry-123",
      userId: "user-123",
      date: "2026-01-29",
      type: "task",
      title: "Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext("entry-123"));

    expect(response.status).toBe(204);
    expect(prisma.entry.delete).toHaveBeenCalledWith({
      where: { id: "entry-123" },
    });
  });

  it("should return 400 when entryId is empty", async () => {
    const request = createRequest("DELETE", undefined, {
      "x-user-id": "user-123",
    });
    const response = await DELETE(request, createContext(""));

    expect(response.status).toBe(400);
  });
});
