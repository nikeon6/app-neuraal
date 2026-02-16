/**
 * Thin wrapper around Sentry for capturing errors in non-Next.js contexts
 * (workers, scripts). Falls back to no-op if Sentry is not initialized.
 */

let Sentry: typeof import("@sentry/nextjs") | null = null;
const isProduction = process.env.NODE_ENV === "production";
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|set-cookie|api[-_]?key/i;

function parseRate(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(raw ?? "");
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(input)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeValue(entry);
    }

    return output;
  }

  return value;
}

/**
 * Lazily initializes Sentry for worker processes.
 * Must be called once at worker startup.
 */
export function initSentryForWorker(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const tracesSampleRate = parseRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    isProduction ? 0.1 : 1,
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Sentry = require("@sentry/nextjs");
    Sentry?.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
      release: process.env.SENTRY_RELEASE ?? undefined,
      tracesSampleRate,
      beforeSend(event) {
        const sanitized = sanitizeValue(event);
        return sanitized as typeof event;
      },
    });
  } catch {
    // Sentry not available — silently ignore
  }
}

/**
 * Captures an exception in Sentry (if initialized).
 */
export function captureWorkerException(
  error: unknown,
  context: {
    queue: string;
    jobId?: string;
    action?: string;
    userId?: string;
  },
): void {
  if (!Sentry) return;

  Sentry.captureException(error, {
    tags: {
      queue: context.queue,
      jobId: context.jobId,
      action: context.action,
    },
    user: context.userId ? { id: context.userId } : undefined,
  });
}
