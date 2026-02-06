import { NextResponse } from "next/server";
import spec from "../../../../openapi/spec";

/**
 * GET /api/openapi.json
 * Serves the OpenAPI 3.1 specification as JSON.
 * No authentication required — public endpoint.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
