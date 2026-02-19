import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/transcriptions/RequestTranscription", () => ({
  RequestTranscription: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

vi.mock("@/infrastructure/queue/BullMQAdapter", () => ({
  BullMQAdapter: class {
    close(...args: unknown[]) {
      return mocks.close(...args);
    }
  },
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}
function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/entries/[id]/transcription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when entry id is empty", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries//transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: " " }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when youtubeUrl is missing", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("maps CONFLICT to 409", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("CONFLICT", "already processing"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(409);
    expect(mocks.close).toHaveBeenCalled();
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "entry not found"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("maps unknown use-case errors to 400", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(err("VALIDATION_ERROR", "bad payload"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 202 on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue(
      ok({ requestId: "r1", notificationId: "n1" }),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requestId).toBe("r1");
  });

  it("returns 500 and handles queue close cleanup errors", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockRejectedValue(new Error("queue crash"));
    mocks.close.mockRejectedValue(new Error("close failed"));
    const req = new NextRequest(
      "http://localhost:3000/api/entries/e1/transcription",
      {
        method: "POST",
        body: JSON.stringify({ youtubeUrl: "https://youtube.com/watch?v=1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(500);
  });
});
