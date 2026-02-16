import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock(
  "@/application/use-cases/transcriptions/HandleTranscriptionCallback",
  () => ({
    HandleTranscriptionCallback: class {
      execute(...args: unknown[]) {
        return mocks.execute(...args);
      }
    },
  }),
);

vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {},
}));
vi.mock(
  "@/infrastructure/persistence/PrismaTranscriptionRequestRepository",
  () => ({
    PrismaTranscriptionRequestRepository: class {},
  }),
);
vi.mock("@/infrastructure/persistence/PrismaNotificationRepository", () => ({
  PrismaNotificationRepository: class {},
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

describe("POST /api/automations/entry-transcription/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
  });

  it("returns 401 when signature headers are missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        headers: {
          "X-Timestamp": "1",
          "X-Signature": "abc",
          "Content-Type": "application/json",
        },
        body: "{",
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required payload fields", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        headers: {
          "X-Timestamp": "1",
          "X-Signature": "abc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: "r1" }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when webhook secret is missing", async () => {
    process.env.N8N_WEBHOOK_SECRET = "";
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        headers: {
          "X-Timestamp": "1",
          "X-Signature": "abc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: "r1",
          userId: "u1",
          entryId: "e1",
          youtubeUrl: "https://youtube.com/watch?v=1",
          transcription: "hello",
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("maps use case NOT_FOUND to 404", async () => {
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        headers: {
          "X-Timestamp": "1",
          "X-Signature": "abc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: "r1",
          userId: "u1",
          entryId: "e1",
          youtubeUrl: "https://youtube.com/watch?v=1",
          transcription: "hello",
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mocks.execute.mockResolvedValue(
      ok({ success: true, alreadyProcessed: false }),
    );
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcription/callback",
      {
        method: "POST",
        headers: {
          "X-Timestamp": "1",
          "X-Signature": "abc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: "r1",
          userId: "u1",
          entryId: "e1",
          youtubeUrl: "https://youtube.com/watch?v=1",
          transcription: "hello",
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
