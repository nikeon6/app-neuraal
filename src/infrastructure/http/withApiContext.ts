import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getRequestId } from "./requestContext";
import { withRequestContext } from "@/infrastructure/logging/logger";
import type { RequestContext } from "@/infrastructure/logging/logger";

/**
 * API route context available to every wrapped handler.
 */
export interface ApiContext {
  /** Unique request identifier (propagated via x-request-id header) */
  requestId: string;
  /** Structured logger enriched with request context */
  log: ReturnType<typeof withRequestContext>;
}

/**
 * Handler function signature that receives the original request + context.
 */
type ApiHandler = (
  request: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
) => Promise<NextResponse>;

/**
 * Wraps a Next.js API route handler with:
 * - Request ID generation / propagation
 * - Structured request/response logging
 * - Duration tracking
 * - Automatic error capture + 500 fallback
 *
 * @example
 * ```ts
 * export const GET = withApiContext(async (request, { log, requestId }) => {
 *   log.info("Processing request");
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withApiContext(handler: ApiHandler) {
  return async (
    request: NextRequest,
    routeParams?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    const { method } = request;
    const route = request.nextUrl.pathname;

    const reqCtx: RequestContext = { requestId, route, method };
    const log = withRequestContext(reqCtx);

    const start = performance.now();

    log.info({ url: route, method }, "request.start");

    try {
      const resolvedParams = routeParams ? await routeParams.params : undefined;
      const response = await handler(request, { requestId, log }, resolvedParams);

      const durationMs = Math.round(performance.now() - start);
      const status = response.status;

      // Attach request ID to response
      response.headers.set("x-request-id", requestId);

      log.info({ status, durationMs }, "request.end");

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);

      log.error(
        { err: error, durationMs },
        "request.unhandled_error"
      );

      // Report to Sentry with context
      Sentry.captureException(error, {
        tags: { route, requestId },
        extra: { method, durationMs },
      });

      const errorResponse = NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
            requestId,
          },
        },
        { status: 500 }
      );
      errorResponse.headers.set("x-request-id", requestId);
      return errorResponse;
    }
  };
}
