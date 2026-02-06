import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, get, post, patch, del, ApiError } from "./apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal Response-like object that `fetch` would return. */
function jsonResponse(
  body: unknown,
  status = 200,
  contentType = "application/json"
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("apiFetch", () => {
  // -----------------------------------------------------------------------
  // Basic request mechanics
  // -----------------------------------------------------------------------

  it("should call fetch with the correct URL (same-origin by default)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/api/topics");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/topics");
  });

  it("should prepend NEXT_PUBLIC_API_BASE_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/api/topics");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/topics");
  });

  it("should strip trailing slash from base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com/");
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch("/api/topics");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/topics");
  });

  it("should default to GET method", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
  });

  it("should set Accept: application/json header", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
  });

  // -----------------------------------------------------------------------
  // JSON body handling
  // -----------------------------------------------------------------------

  it("should serialize body as JSON and set Content-Type", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: "1" }, 201));

    const body = { name: "Work", color: "#e11d48" };
    await apiFetch("/api/topics", { method: "POST", body });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("should NOT set Content-Type for requests without body", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Response parsing
  // -----------------------------------------------------------------------

  it("should parse JSON response", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ topics: [{ id: "1", name: "Work" }] })
    );

    const data = await apiFetch<{ topics: { id: string; name: string }[] }>(
      "/api/topics"
    );

    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].name).toBe("Work");
  });

  it("should return text when content-type is not JSON", async () => {
    fetchSpy.mockResolvedValueOnce(textResponse("plain text body"));

    const data = await apiFetch<string>("/api/health");

    expect(data).toBe("plain text body");
  });

  it("should return null for 204 No Content", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: {} })
    );

    const data = await apiFetch("/api/topics/1", { method: "DELETE" });

    expect(data).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("should throw ApiError with code/message from structured error body", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: "NOT_FOUND", message: "Topic not found" } },
        404
      )
    );

    try {
      await apiFetch("/api/topics/999");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Topic not found");
    }
  });

  it("should throw ApiError with raw body when error is not structured JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      textResponse("Internal Server Error", 500)
    );

    try {
      await apiFetch("/api/boom");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(500);
      expect(err.code).toBeUndefined();
      expect(err.details).toBe("Internal Server Error");
    }
  });

  it("should throw ApiError with code/message from non-structured JSON error", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ message: "Rate limit exceeded" }, 429)
    );

    try {
      await apiFetch("/api/topics");
      expect.unreachable("Should have thrown");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBeUndefined();
      // The raw JSON is attached as details
      expect(err.details).toBeDefined();
    }
  });

  // -----------------------------------------------------------------------
  // Timeout
  // -----------------------------------------------------------------------

  it("should abort after default timeout", async () => {
    vi.useFakeTimers();

    fetchSpy.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const promise = apiFetch("/api/slow");

    // Advance past the default 15s timeout
    vi.advanceTimersByTime(16_000);

    await expect(promise).rejects.toThrow("Request timed out");

    vi.useRealTimers();
  });

  it("should allow custom timeout", async () => {
    vi.useFakeTimers();

    fetchSpy.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const promise = apiFetch("/api/slow", { timeoutMs: 5_000 });

    vi.advanceTimersByTime(6_000);

    await expect(promise).rejects.toThrow("Request timed out");

    vi.useRealTimers();
  });

  it("should respect caller-provided AbortSignal", async () => {
    const controller = new AbortController();

    fetchSpy.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const promise = apiFetch("/api/slow", { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // Dev auth header (x-user-id)
  // -----------------------------------------------------------------------

  it("should inject x-user-id in development when NEXT_PUBLIC_DEV_USER_ID is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_USER_ID", "user-123");

    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("user-123");
  });

  it("should NOT inject x-user-id in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_USER_ID", "user-123");

    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBeNull();
  });

  it("should NOT inject x-user-id when NEXT_PUBLIC_DEV_USER_ID is empty", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_USER_ID", "");

    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBeNull();
  });

  it("should NOT inject x-user-id when NEXT_PUBLIC_DEV_USER_ID is not set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // NEXT_PUBLIC_DEV_USER_ID is not set

    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBeNull();
  });

  it("should NOT overwrite caller-provided x-user-id", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_USER_ID", "user-123");

    fetchSpy.mockResolvedValueOnce(jsonResponse([]));

    await apiFetch("/api/topics", {
      headers: { "x-user-id": "custom-user" },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-user-id")).toBe("custom-user");
  });
});

// ---------------------------------------------------------------------------
// Shorthand helpers
// ---------------------------------------------------------------------------

describe("HTTP method helpers", () => {
  beforeEach(() => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
  });

  it("get() should call apiFetch with GET", async () => {
    await get("/api/topics");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
  });

  it("post() should call apiFetch with POST and body", async () => {
    await post("/api/topics", { name: "Work" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Work" }));
  });

  it("patch() should call apiFetch with PATCH and body", async () => {
    await patch("/api/topics/1", { name: "Updated" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ name: "Updated" }));
  });

  it("del() should call apiFetch with DELETE", async () => {
    await del("/api/topics/1");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});
