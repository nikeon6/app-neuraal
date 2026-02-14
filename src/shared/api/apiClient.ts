/**
 * Centralized API client for the Neuraal frontend.
 *
 * All HTTP calls to the backend should go through this module so that
 * headers, auth, errors, timeouts and base URL are handled in one place.
 *
 * When JWT auth is implemented, only this file needs to change
 * (swap x-user-id for Authorization: Bearer ...).
 *
 * @example
 * ```ts
 * import { get, post, patch, del } from "@/shared/api";
 *
 * // GET /api/topics
 * const { topics } = await get<{ topics: TopicDTO[] }>("/api/topics");
 *
 * // POST /api/entries
 * const { entry } = await post<{ entry: EntryDTO }>("/api/entries", {
 *   date: "2025-06-15",
 *   type: "task",
 *   title: "My task",
 *   content: {},
 * });
 *
 * // PATCH /api/topics/:id
 * await patch("/api/topics/abc", { name: "Renamed" });
 *
 * // DELETE /api/topics/:id
 * await del("/api/topics/abc");
 *
 * // Custom options
 * const data = await apiFetch("/api/slow", { timeoutMs: 30_000 });
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structured error thrown on non-2xx responses.
 *
 * - `status`  — HTTP status code (e.g. 404, 500)
 * - `code`    — Backend error code if available (e.g. "NOT_FOUND")
 * - `message` — Human-readable message
 * - `details` — Raw response body when it's not structured JSON
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Options accepted by `apiFetch`, extending the standard fetch `RequestInit`.
 *
 * - `body`      — Will be JSON-serialized automatically (pass a plain object).
 * - `timeoutMs` — Request timeout in milliseconds (default 15 000).
 * - `headers`   — Extra headers (merged with defaults).
 * - `signal`    — Caller-provided AbortSignal (combined with timeout signal).
 */
export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the base URL for API requests.
 * Empty string means same-origin (default for Next.js).
 */
function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  return base.replace(/\/+$/, ""); // strip trailing slashes
}

/**
 * Returns the dev user ID to inject as `x-user-id`, or `undefined` if it
 * should not be injected (production, empty value, or not configured).
 */
function getDevUserId(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;

  const id = process.env.NEXT_PUBLIC_DEV_USER_ID;
  return id && id.trim().length > 0 ? id.trim() : undefined;
}

/**
 * Returns `true` when the response content-type indicates JSON.
 */
function isJsonContentType(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

/**
 * Builds an `ApiError` from a non-2xx `Response`.
 */
async function buildApiError(response: Response): Promise<ApiError> {
  const { status } = response;

  // Try to read the body as text first
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    return new ApiError(`Request failed with status ${status}`, status);
  }

  // Attempt to parse as JSON to extract structured { error: { code, message } }
  if (isJsonContentType(response)) {
    try {
      const json = JSON.parse(rawBody) as Record<string, unknown>;

      // Standard backend shape: { error: { code, message } }
      if (
        json.error &&
        typeof json.error === "object" &&
        !Array.isArray(json.error)
      ) {
        const err = json.error as Record<string, unknown>;
        return new ApiError(
          (err.message as string) ?? `Request failed with status ${status}`,
          status,
          err.code as string | undefined,
          json,
        );
      }

      // Non-standard JSON error (e.g. { message: "..." })
      const msg =
        typeof json.message === "string"
          ? json.message
          : `Request failed with status ${status}`;
      return new ApiError(msg, status, undefined, json);
    } catch {
      // JSON parse failed — fall through to raw body
    }
  }

  // Plain text error
  return new ApiError(
    `Request failed with status ${status}`,
    status,
    undefined,
    rawBody,
  );
}

// ---------------------------------------------------------------------------
// Auth refresh helpers
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to refresh the auth token. Returns true if successful.
 * Deduplicates concurrent refresh attempts.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Redirects to login page. Only runs in the browser.
 */
function redirectToLoginPage(): void {
  if (globalThis.window !== undefined) {
    globalThis.window.location.href = "/login";
  }
}

function buildRequestInit(
  restInit: Omit<ApiFetchOptions, "body" | "headers" | "timeoutMs" | "signal">,
  headers: Headers,
  body: unknown,
  hasBody: boolean,
  signal?: AbortSignal,
): RequestInit {
  return {
    method: restInit.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal,
    credentials: "include",
    ...restInit,
  };
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return null as T;
  }
  if (isJsonContentType(response)) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

interface RetryContext {
  response: Response;
  path: string;
  url: string;
  restInit: Omit<ApiFetchOptions, "body" | "headers" | "timeoutMs" | "signal">;
  headers: Headers;
  body: unknown;
  hasBody: boolean;
  signal?: AbortSignal;
}

async function handleUnauthorizedRetry(
  context: RetryContext,
): Promise<Response> {
  const { response, path, url, restInit, headers, body, hasBody, signal } =
    context;
  if (response.status !== 401 || path.startsWith("/api/auth/")) {
    return response;
  }

  const refreshed = await attemptTokenRefresh();
  if (!refreshed) {
    redirectToLoginPage();
    throw await buildApiError(response);
  }

  const retryResponse = await fetch(
    url,
    buildRequestInit(restInit, headers, body, hasBody, signal),
  );

  if (retryResponse.status === 401) {
    redirectToLoginPage();
    throw await buildApiError(retryResponse);
  }

  return retryResponse;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Central fetch wrapper. All API calls should use this function.
 *
 * @typeParam T — Expected parsed response type.
 * @param path — API path (e.g. "/api/topics"). Prepended with base URL.
 * @param options — Extended request options.
 * @returns Parsed response body (JSON object, text string, or null for 204).
 * @throws {ApiError} on non-2xx responses.
 * @throws {Error} on network errors or timeout.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    body,
    headers: callerHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...restInit
  } = options;

  // --- URL ------------------------------------------------------------------
  const url = `${getBaseUrl()}${path}`;

  // --- Headers --------------------------------------------------------------
  const headers = new Headers(callerHeaders as HeadersInit);

  // Always request JSON back
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Auto-set Content-Type for JSON bodies
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Dev auth: inject x-user-id if not already set
  const devUserId = getDevUserId();
  if (devUserId && !headers.has("x-user-id")) {
    headers.set("x-user-id", devUserId);
  }

  // --- Timeout + signal -----------------------------------------------------
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine caller signal with timeout signal
  const combinedSignal = callerSignal
    ? combineSignals(callerSignal, timeoutController.signal)
    : timeoutController.signal;

  // --- Fetch ----------------------------------------------------------------
  try {
    let response = await fetch(
      url,
      buildRequestInit(restInit, headers, body, hasBody, combinedSignal),
    );

    if (!response.ok) {
      response = await handleUnauthorizedRetry({
        response,
        path,
        url,
        restInit,
        headers,
        body,
        hasBody,
        signal: combinedSignal,
      });
    }

    if (!response.ok) {
      throw await buildApiError(response);
    }

    return await parseResponseBody<T>(response);
  } catch (error) {
    // Wrap AbortError into a friendlier message
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${timeoutMs}ms: ${options.method ?? "GET"} ${path}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Signal combiner (for timeout + caller abort)
// ---------------------------------------------------------------------------

/**
 * Combines two AbortSignals into one that aborts when either fires.
 */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  // Use AbortSignal.any if available (modern runtimes)
  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b]);
  }

  // Fallback: create a new controller that aborts when either fires
  const controller = new AbortController();

  const onAbort = () => controller.abort();

  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }

  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });

  return controller.signal;
}

// ---------------------------------------------------------------------------
// Shorthand helpers
// ---------------------------------------------------------------------------

/** GET request. */
export function get<T = unknown>(
  path: string,
  options?: Omit<ApiFetchOptions, "method" | "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "GET" });
}

/** POST request with JSON body. */
export function post<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiFetchOptions, "method" | "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "POST", body });
}

/** PATCH request with JSON body. */
export function patch<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiFetchOptions, "method" | "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "PATCH", body });
}

/** DELETE request. */
export function del<T = unknown>(
  path: string,
  options?: Omit<ApiFetchOptions, "method" | "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "DELETE" });
}
