import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  ping: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/infrastructure/persistence/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.query,
  },
  pool: {},
}));

vi.mock("ioredis", () => ({
  default: class {
    connect = mocks.connect;
    ping = mocks.ping;
    disconnect = mocks.disconnect;
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue(undefined);
    mocks.connect.mockResolvedValue(undefined);
    mocks.ping.mockResolvedValue("PONG");
    mocks.disconnect.mockReturnValue(undefined);
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.NEXT_PUBLIC_OLLAMA_URL;
    delete process.env.N8N_BASE_URL;
    delete process.env.S3_ENDPOINT;
    vi.restoreAllMocks();
  });

  it("returns 200 and status ok when db/redis are healthy", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.redis.ok).toBe(true);
  });

  it("returns 503 and status down when db fails", async () => {
    mocks.query.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("down");
    expect(body.checks.db.ok).toBe(false);
  });

  it("returns 200 and status degraded when optional dependency fails", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("fail", { status: 500 }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.redis.ok).toBe(true);
    expect(body.checks.ollama.ok).toBe(false);
  });

  it("returns 503 and status down when redis fails", async () => {
    mocks.ping.mockRejectedValue(new Error("redis down"));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("down");
    expect(body.checks.redis.ok).toBe(false);
  });

  it("checks n8n and s3 optional dependencies when configured", async () => {
    process.env.N8N_BASE_URL = "http://n8n";
    process.env.S3_ENDPOINT = "http://minio";
    process.env.S3_BUCKET = "bucket";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 403 }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.n8n.ok).toBe(true);
    expect(body.checks.s3.ok).toBe(true);
  });
});
