import * as Sentry from "@sentry/nextjs";

/**
 * Sentry client-side configuration.
 * Only initializes if NEXT_PUBLIC_SENTRY_DSN is set.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? undefined,

    // Performance
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
    ),

    // Replay (optional)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Filter out noisy errors
    ignoreErrors: [
      "ResizeObserver loop",
      "Network request failed",
      "Load failed",
    ],
  });
}
