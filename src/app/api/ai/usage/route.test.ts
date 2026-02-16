import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  execute: vi.fn(),
  getAiGuardrailsConfig: vi.fn(),
}));

vi.mock("@/infrastructure/auth/getAuthUserId", () => ({
  getAuthUserId: mocks.getAuthUserId,
}));

vi.mock("@/application/use-cases/ai/GetAiUsage", () => ({
  GetAiUsage: class {
    execute(...args: unknown[]) {
      return mocks.execute(...args);
    }
  },
}));

vi.mock("@/infrastructure/config/AiGuardrailsConfig", () => ({
  getAiGuardrailsConfig: mocks.getAiGuardrailsConfig,
}));

import { GET } from "./route";

describe("GET /api/ai/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiGuardrailsConfig.mockReturnValue({
      summary: {
        monthlyQuotaRequests: 1,
        monthlyQuotaTokens: 1,
        maxActivePerUser: 1,
        rateLimitPerMinute: 1,
        maxInputChars: 1,
      },
      transcriptYoutube: {
        monthlyQuotaRequests: 1,
        monthlyQuotaTokens: 1,
        maxActivePerUser: 1,
        rateLimitPerMinute: 1,
        maxInputChars: 1,
      },
      ocrImage: {
        monthlyQuotaRequests: 1,
        monthlyQuotaTokens: 1,
        maxActivePerUser: 1,
        rateLimitPerMinute: 1,
        maxInputBytes: 1,
      },
      reminderWhatsapp: {
        monthlyQuotaRequests: 1,
        maxActivePerUser: 1,
        rateLimitPerMinute: 1,
        maxInputChars: 1,
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: false, error: "Unauthorized" });
    const req = new NextRequest("http://localhost:3000/api/ai/usage");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns usage output on success", async () => {
    mocks.getAuthUserId.mockResolvedValue({ ok: true, userId: "u1" });
    mocks.execute.mockResolvedValue({
      items: [{ action: "SUMMARY", requestsUsed: 0 }],
    });
    const req = new NextRequest(
      "http://localhost:3000/api/ai/usage?action=SUMMARY",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].action).toBe("SUMMARY");
  });
});
