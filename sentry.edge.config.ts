import * as Sentry from "@sentry/nextjs";

/**
 * Sentry edge configuration (for proxy / edge runtime).
 * Only initializes if SENTRY_DSN is set.
 */
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    release: process.env.SENTRY_RELEASE ?? undefined,
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
    ),
  });
}
