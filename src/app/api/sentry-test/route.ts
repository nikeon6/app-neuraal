import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * GET /api/sentry-test
 *
 * Development-focused endpoint to verify Sentry is configured correctly.
 * - Sends a test message and a test exception to Sentry.
 * - Only enabled when SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is set.
 * - In production, requires SENTRY_TEST_TOKEN + x-sentry-test-token header.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isProduction = process.env.NODE_ENV === "production";
  const sentryTestToken = process.env.SENTRY_TEST_TOKEN;

  if (isProduction) {
    // Hide route in production unless explicitly enabled with a token.
    if (!sentryTestToken) {
      return NextResponse.json(
        { ok: false, message: "Not found" },
        { status: 404 },
      );
    }

    const providedToken = request.headers.get("x-sentry-test-token");
    if (providedToken !== sentryTestToken) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
  }

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
