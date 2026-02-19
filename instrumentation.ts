/**
 * Next.js instrumentation hook — required to initialize Sentry on the server.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This file is loaded once per server process. Sentry must be initialized here
 * (not inside route handlers) so that captureException / captureMessage work
 * before any request is processed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Captures unhandled errors thrown during server-side request handling
 * (Next.js 15+ hook, works alongside withApiContext).
 */
export const onRequestError = async (
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string },
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(error, request, context);
};
