import * as Sentry from "@sentry/nextjs";

export interface SentrySpanInput {
  name: string;
  op: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

/**
 * Runs the provided callback inside a Sentry span when tracing is enabled.
 * Falls back to direct execution when Sentry tracing APIs are unavailable.
 */
export function withSentrySpan<T>(
  span: SentrySpanInput,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  if (typeof Sentry.startSpan !== "function") {
    return callback();
  }

  return Sentry.startSpan(
    {
      name: span.name,
      op: span.op,
      attributes: span.attributes,
    },
    callback,
  );
}
