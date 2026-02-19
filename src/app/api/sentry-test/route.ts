import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * GET /api/sentry-test
 *
 * Development-only endpoint to verify Sentry is configured correctly.
 * - Sends a test message and a test exception to Sentry.
 * - Only enabled when SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is set.
 * - Remove or gate behind a secret when deploying to production.
 */
export async function GET(): Promise<NextResponse> {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Sentry is not configured. Set SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN in your environment.",
      },
      { status: 503 },
    );
  }

  const testError = new Error("Sentry test exception from /api/sentry-test");

  Sentry.captureMessage("Sentry test message from /api/sentry-test", "info");
  Sentry.captureException(testError, {
    tags: { route: "/api/sentry-test", source: "manual-test" },
  });

  return NextResponse.json({
    ok: true,
    message: "Test event sent to Sentry. Check your Sentry Issues dashboard.",
    dsn: dsn.replace(/\/\/(.+?)@/, "//[redacted]@"),
  });
}
