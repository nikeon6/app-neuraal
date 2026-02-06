import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/openapi.json", () => {
  it("should return 200", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("should return valid JSON with openapi field", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.openapi).toBe("3.1.0");
  });

  it("should include info.title", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.info).toBeDefined();
    expect(body.info.title).toBe("Neuraal API");
  });

  it("should include /api/topics in paths", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.paths).toBeDefined();
    expect(body.paths["/api/topics"]).toBeDefined();
  });

  it("should include /api/entries in paths", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.paths["/api/entries"]).toBeDefined();
  });

  it("should include /api/reminders in paths", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.paths["/api/reminders"]).toBeDefined();
  });

  it("should include /api/notifications in paths", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.paths["/api/notifications"]).toBeDefined();
  });

  it("should include callback endpoint in paths", async () => {
    const response = await GET();
    const body = await response.json();
    expect(
      body.paths["/api/automations/entry-summary/callback"]
    ).toBeDefined();
  });

  it("should include securitySchemes", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.components.securitySchemes).toBeDefined();
    expect(body.components.securitySchemes.DevUserIdHeader).toBeDefined();
    expect(body.components.securitySchemes.BearerAuth).toBeDefined();
  });

  it("should include component schemas", async () => {
    const response = await GET();
    const body = await response.json();
    const schemas = body.components.schemas;
    expect(schemas.Topic).toBeDefined();
    expect(schemas.Entry).toBeDefined();
    expect(schemas.Reminder).toBeDefined();
    expect(schemas.Notification).toBeDefined();
    expect(schemas.ErrorResponse).toBeDefined();
  });

  it("should set Cache-Control header", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600"
    );
  });
});
