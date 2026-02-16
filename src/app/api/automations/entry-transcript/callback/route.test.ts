import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock(
  "@/application/use-cases/transcripts/HandleEntryTranscriptCallback",
  () => ({
    HandleEntryTranscriptCallback: class {
      execute(...args: unknown[]) {
        return mocks.execute(...args);
      }
    },
  }),
);

vi.mock("@/application/use-cases/ai/RecordAiUsageFromCallback", () => ({
  RecordAiUsageFromCallback: class {},
}));
vi.mock(
  "@/infrastructure/persistence/PrismaTranscriptRequestRepository",
  () => ({
    PrismaTranscriptRequestRepository: class {},
  }),
);
vi.mock("@/infrastructure/persistence/PrismaEntryRepository", () => ({
  PrismaEntryRepository: class {},
}));
vi.mock("@/infrastructure/persistence/PrismaNotificationRepository", () => ({
  PrismaNotificationRepository: class {},
}));
vi.mock("@/infrastructure/persistence/PrismaAiUsageRepository", () => ({
  PrismaAiUsageRepository: class {},
}));
vi.mock("@/infrastructure/auth/SystemClock", () => ({
  SystemClock: class {},
}));

import { POST } from "./route";

function ok<T>(value: T) {
  return { isErr: () => false, value };
}

function err(code: string, message: string) {
  return { isErr: () => true, error: { code, message } };
}

function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

describe("POST /api/automations/entry-transcript/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
  });

  it("returns 401 when signature headers are missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcript/callback",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    const body = JSON.stringify({
      requestId: "r1",
      userId: "u1",
      entryId: "e1",
      transcriptText: "hello",
    });
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcript/callback",
      {
        method: "POST",
        headers: { "x-timestamp": "123", "x-signature": "bad" },
        body,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON with valid signature", async () => {
    const timestamp = "123";
    const rawBody = "{";
    const signature = sign(
      process.env.N8N_WEBHOOK_SECRET ?? "",
      timestamp,
      rawBody,
    );
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcript/callback",
      {
        method: "POST",
        headers: { "x-timestamp": timestamp, "x-signature": signature },
        body: rawBody,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("maps NOT_FOUND to 404", async () => {
    mocks.execute.mockResolvedValue(err("NOT_FOUND", "missing"));
    const payload = {
      requestId: "r1",
      userId: "u1",
      entryId: "e1",
      transcriptText: "hello",
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = "123";
    const signature = sign(
      process.env.N8N_WEBHOOK_SECRET ?? "",
      timestamp,
      rawBody,
    );
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcript/callback",
      {
        method: "POST",
        headers: {
          "x-timestamp": timestamp,
          "x-signature": signature,
          "Content-Type": "application/json",
        },
        body: rawBody,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mocks.execute.mockResolvedValue(ok({ success: true }));
    const payload = {
      requestId: "r1",
      userId: "u1",
      entryId: "e1",
      transcriptText: "hello",
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = "123";
    const signature = sign(
      process.env.N8N_WEBHOOK_SECRET ?? "",
      timestamp,
      rawBody,
    );
    const req = new NextRequest(
      "http://localhost:3000/api/automations/entry-transcript/callback",
      {
        method: "POST",
        headers: {
          "x-timestamp": timestamp,
          "x-signature": signature,
          "Content-Type": "application/json",
        },
        body: rawBody,
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
