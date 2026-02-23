import { NextRequest, NextResponse } from "next/server";
import { registry } from "@/infrastructure/metrics/metrics";

/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint.
 *
 * Protected by METRICS_TOKEN env var (bearer auth) when set.
 * In development, accessible without auth if METRICS_TOKEN is not set.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const metricsToken = process.env.METRICS_TOKEN;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !metricsToken) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Metrics endpoint disabled: METRICS_TOKEN not configured",
        },
      },
      { status: 403 },
    );
  }

  if (metricsToken) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${metricsToken}`) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid metrics token" } },
        { status: 401 },
      );
    }
  }

  try {
    const metrics = await registry.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        "Content-Type": registry.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Failed to collect metrics" },
      },
      { status: 500 },
    );
  }
}
