import type { NextRequest } from "next/server";
import { JoseJwtService } from "./JoseJwtService";

/**
 * Auth error response.
 */
export interface AuthError {
  code: "UNAUTHORIZED";
  message: string;
}

/**
 * Result of auth check.
 */
export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: AuthError };

/**
 * Extracts the authenticated user ID from the request.
 *
 * Priority chain:
 * 1. Cookie `access_token` → verify JWT → extract userId
 * 2. Dev fallback: `x-user-id` header if NODE_ENV !== "production"
 * 3. Else → UNAUTHORIZED
 *
 * @param request - The incoming Next.js request
 * @returns AuthResult with userId on success, or error on failure
 */
export async function getAuthUserId(request: NextRequest): Promise<AuthResult> {
  // 1. Try JWT from cookie
  const accessToken = request.cookies.get("access_token")?.value;

  if (accessToken) {
    const jwtSecret = process.env.AUTH_JWT_SECRET;
    if (jwtSecret) {
      const jwtService = new JoseJwtService(jwtSecret);
      const payload = await jwtService.verify(accessToken);

      if (payload) {
        return { ok: true, userId: payload.sub };
      }
    }
    // If token exists but is invalid/expired, fall through to dev fallback
  }

  // 2. Dev fallback: x-user-id header (non-production only)
  if (process.env.NODE_ENV !== "production") {
    const userId = request.headers.get("x-user-id");
    if (userId && userId.trim().length > 0) {
      return { ok: true, userId: userId.trim() };
    }
  }

  // 3. No valid auth found
  return {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  };
}
