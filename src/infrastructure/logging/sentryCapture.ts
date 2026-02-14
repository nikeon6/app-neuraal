/**
 * Thin wrapper around Sentry for capturing errors in non-Next.js contexts
 * (workers, scripts). Falls back to no-op if Sentry is not initialized.
 */

let Sentry: typeof import("@sentry/nextjs") | null = null;

/**
 * Lazily initializes Sentry for worker processes.
 * Must be called once at worker startup.
 */
export function initSentryForWorker(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Sentry = require("@sentry/nextjs");
    Sentry?.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
      release: process.env.SENTRY_RELEASE ?? undefined,
      tracesSampleRate: parseFloat(
        process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
      ),
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
