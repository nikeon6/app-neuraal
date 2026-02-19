import { test, expect } from "@playwright/test";

test.describe("Operational Endpoints", () => {
  test("GET /api/health returns status", async ({ request }) => {
    const response = await request.get("/api/health");
    // Health endpoint may return 200 (ok/degraded) or 503 (down)
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body.status).toMatch(/ok|degraded|down/);
    expect(body.checks).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  test("GET /api/metrics returns Prometheus metrics", async ({ request }) => {
    const response = await request.get("/api/metrics");
    // May return 401 if METRICS_TOKEN is set
    if (response.status() === 200) {
      const text = await response.text();
      expect(text).toContain("neuraal_");
    }
  });

  test("GET /api/openapi.json returns OpenAPI spec", async ({ request }) => {
    const response = await request.get("/api/openapi.json");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.openapi).toBeDefined();
  });
});
