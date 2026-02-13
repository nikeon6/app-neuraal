import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  metrics: vi.fn(),
}));

vi.mock("@/infrastructure/metrics/metrics", () => ({
  registry: {
    metrics: mocks.metrics,
    contentType: "text/plain; version=0.0.4",
  },
}));

import { GET } from "./route";

describe("GET /api/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.METRICS_TOKEN;
  });

  it("returns 401 when token is configured but missing", async () => {
    process.env.METRICS_TOKEN = "secret";
    const req = new NextRequest("http://localhost:3000/api/metrics");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with metrics text", async () => {
    process.env.METRICS_TOKEN = "secret";
    mocks.metrics.mockResolvedValue("my_metric 1\n");
    const req = new NextRequest("http://localhost:3000/api/metrics", {
      headers: { authorization: "Bearer secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("my_metric");
  });

  it("returns 500 when metrics collection fails", async () => {
    mocks.metrics.mockRejectedValue(new Error("boom"));
    const req = new NextRequest("http://localhost:3000/api/metrics");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
