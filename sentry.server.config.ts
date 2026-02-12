import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server-side configuration.
 * Only initializes if SENTRY_DSN is set.
 */
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    release: process.env.SENTRY_RELEASE ?? undefined,

    // Performance
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
    ),
  });
}
