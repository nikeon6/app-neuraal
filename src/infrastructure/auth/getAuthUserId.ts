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

let devHeaderWarningLogged = false;

function isDevHeaderEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_USER_HEADER === "true"
  );
}

/**
 * Extracts the authenticated user ID from the request.
 *
 * Priority chain:
 * 1. Cookie `access_token` → verify JWT → extract userId
 * 2. Dev fallback: `x-user-id` header (requires NODE_ENV !== "production"
 *    AND explicit ALLOW_DEV_USER_HEADER=true)
 * 3. Else → UNAUTHORIZED
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
  }

  // 2. Dev fallback: x-user-id header (explicit opt-in only)
  if (isDevHeaderEnabled()) {
    const userId = request.headers.get("x-user-id");
    if (userId && userId.trim().length > 0) {
      if (!devHeaderWarningLogged) {
        console.warn(
          "[AUTH] x-user-id header fallback is ACTIVE. " +
            "This must NEVER be enabled in production. " +
            "Set ALLOW_DEV_USER_HEADER to anything other than 'true' to disable.",
        );
        devHeaderWarningLogged = true;
      }
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
