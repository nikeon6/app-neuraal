import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Public paths that do NOT require authentication.
 * Includes auth routes, static assets, public pages, and operational endpoints.
 */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/recover",
  "/api/auth/",
  "/api/automations/",
  "/api/openapi.json",
  "/api/health",
  "/api/metrics",
];

/**
 * Checks if a pathname matches any public path prefix.
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Returns true if the request should skip auth checks entirely.
 */
function shouldSkipAuth(pathname: string, request: NextRequest): boolean {
  if (isPublicPath(pathname)) return true;

  // Static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return true;
  }

  // Dev fallback: x-user-id header in non-production
  if (process.env.NODE_ENV !== "production") {
    const devUserId = request.headers.get("x-user-id");
    if (devUserId && devUserId.trim().length > 0) return true;
  }

  return false;
}

/**
 * Returns a 401 JSON response for unauthenticated API requests.
 */
function denyApiAccess(): NextResponse {
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "Authentication required" },
    { status: 401 }
  );
}

/**
 * Returns the deny response appropriate for the route type:
 * - API routes → 401 JSON (client interceptor can attempt refresh)
 * - Page routes → redirect to /login
 */
function denyPageAccess(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Next.js proxy for route protection (renamed from middleware in Next.js 16).
 *
 * - Protects all routes except public ones
 * - Reads `access_token` cookie and verifies JWT signature (no DB call)
 * - API routes receive 401 JSON; page routes get redirected to /login
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (shouldSkipAuth(pathname, request)) {
    return NextResponse.next();
  }

  const deny = pathname.startsWith("/api/")
    ? () => denyApiAccess()
    : () => denyPageAccess(request);

  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return deny();
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    // No secret configured — allow in development, deny in production
    return process.env.NODE_ENV === "production"
      ? deny()
      : NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    await jwtVerify(accessToken, secret, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return deny();
  }
}

/**
 * Matcher configuration — excludes paths that should never go through the proxy.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
