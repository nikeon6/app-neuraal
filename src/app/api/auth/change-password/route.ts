import { NextRequest, NextResponse } from "next/server";
import { ChangePassword } from "@/application/use-cases/auth/ChangePassword";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { clearAuthCookies } from "@/infrastructure/auth/AuthCookies";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { withApiContext } from "@/infrastructure/http/withApiContext";
import type { UseCaseErrorCode } from "@/application/core/UseCaseError";

function errorCodeToStatus(code: UseCaseErrorCode): number {
  const map: Record<UseCaseErrorCode, number> = {
    VALIDATION_ERROR: 400,
    DUPLICATE_ERROR: 409,
    UNAUTHORIZED: 401,
    EMAIL_NOT_VERIFIED: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    QUOTA_EXCEEDED: 429,
    RATE_LIMITED: 429,
    CONCURRENCY_LIMIT: 429,
    INPUT_TOO_LARGE: 413,
    INTERNAL_ERROR: 500,
  };
  return map[code] ?? 500;
}

/**
 * POST /api/auth/change-password
 * Changes the password for the authenticated user.
 * Requires { currentPassword, newPassword } in the body.
 */
export const POST = withApiContext(async (request: NextRequest) => {
  const authResult = await getAuthUserId(request);

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!body.currentPassword || typeof body.currentPassword !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "currentPassword is required",
        },
      },
      { status: 400 },
    );
  }

  if (!body.newPassword || typeof body.newPassword !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "newPassword is required",
        },
      },
      { status: 400 },
    );
  }

  const useCase = new ChangePassword(
    new PrismaUserRepository(),
    new PrismaRefreshTokenRepository(),
    new BcryptPasswordHasher(),
    new SystemClock(),
  );

  const result = await useCase.execute({
    userId: authResult.userId,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = errorCodeToStatus(code);
    return NextResponse.json({ error: { code, message } }, { status });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearAuthCookies(response, getAuthConfig());
  return response;
});
