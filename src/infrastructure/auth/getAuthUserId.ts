import type { NextRequest } from "next/server";

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
 * TODO: Replace this temporary implementation with real auth when implemented.
 * Current implementation reads from "x-user-id" header for development.
 * 
 * Future implementation should:
 * - Parse JWT from httpOnly cookie
 * - Verify token signature and expiration
 * - Extract userId from token payload
 * 
 * @param request - The incoming Next.js request
 * @returns AuthResult with userId on success, or error on failure
 */
export function getAuthUserId(request: NextRequest): AuthResult {
  // TODO: Replace with real JWT auth when implemented
  // This is a temporary solution for development/testing
  
  const userId = request.headers.get("x-user-id");

  if (!userId || userId.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Provide x-user-id header.",
      },
    };
  }

  return {
    ok: true,
    userId: userId.trim(),
  };
}
