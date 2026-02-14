import * as Sentry from "@sentry/nextjs";

/**
 * Sentry edge configuration (for proxy / edge runtime).
 * Only initializes if SENTRY_DSN is set.
 */
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
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

if (dsn) {
  const tracesSampleRate = parseRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    isProduction ? 0.1 : 1,
  );

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    release: process.env.SENTRY_RELEASE ?? undefined,
    tracesSampleRate,
    beforeSend(event) {
      const nextEvent = { ...event };

      if (nextEvent.request?.headers) {
        nextEvent.request = {
          ...nextEvent.request,
          headers: sanitizeValue(nextEvent.request.headers) as Record<
            string,
            string
          >,
        };
      }

      if (nextEvent.extra) {
        nextEvent.extra = sanitizeValue(nextEvent.extra) as Record<
          string,
          unknown
        >;
      }

      return nextEvent;
    },
  });
}
