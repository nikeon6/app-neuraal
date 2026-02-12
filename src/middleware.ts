import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Public paths that do NOT require authentication.
 * Includes auth routes, static assets, and public pages.
 */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/recover",
  "/api/auth/",
  "/api/automations/",
  "/api/openapi.json",
];

/**
 * Checks if a pathname matches any public path prefix.
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Next.js middleware for route protection.
 *
 * - Protects all routes except public ones
 * - Reads `access_token` cookie and verifies JWT signature (no DB call)
 * - If valid → continue
 * - If no token → redirect to /login
 * - If expired/invalid → redirect to /login (client-side refresh handles token renewal)
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Dev fallback: if x-user-id header is present and not production, allow through
  // This keeps backward compatibility with dev tools/tests
  if (process.env.NODE_ENV !== "production") {
    const devUserId = request.headers.get("x-user-id");
    if (devUserId && devUserId.trim().length > 0) {
      return NextResponse.next();
    }
  }

  // Check for access_token cookie
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return redirectToLogin(request);
  }

  // Verify JWT signature (no DB call)
  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    // If no secret configured, allow through in development
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }
    return redirectToLogin(request);
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    await jwtVerify(accessToken, secret, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    // Token invalid or expired — redirect to login
    // The client-side 401 interceptor will attempt refresh before this point
    return redirectToLogin(request);
  }
}

/**
 * Redirects to /login preserving the original URL as a query parameter.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Matcher configuration — excludes paths that should never go through middleware.
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
