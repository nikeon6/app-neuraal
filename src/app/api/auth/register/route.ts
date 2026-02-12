import { NextRequest, NextResponse } from "next/server";
import { RegisterUser } from "@/application/use-cases/auth/RegisterUser";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { JoseJwtService } from "@/infrastructure/auth/JoseJwtService";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { setAuthCookies } from "@/infrastructure/auth/AuthCookies";
import type { UseCaseErrorCode } from "@/application/core/UseCaseError";

function errorCodeToStatus(code: UseCaseErrorCode): number {
  const map: Record<UseCaseErrorCode, number> = {
    VALIDATION_ERROR: 400,
    DUPLICATE_ERROR: 409,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    QUOTA_EXCEEDED: 429,
    INTERNAL_ERROR: 500,
  };
  return map[code] ?? 500;
}

/**
 * POST /api/auth/register
 * Registers a new user and returns auth cookies.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "email and password are required" } },
      { status: 400 }
    );
  }

  const config = getAuthConfig();
  const useCase = new RegisterUser(
    new PrismaUserRepository(),
    new PrismaRefreshTokenRepository(),
    new BcryptPasswordHasher(),
    new JoseJwtService(config.jwtSecret),
    new CryptoRefreshTokenService(),
    new SystemClock(),
    config.accessTtlSeconds,
    config.refreshTtlDays
  );

  const result = await useCase.execute({ email: body.email, password: body.password });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = errorCodeToStatus(code);
    return NextResponse.json({ error: { code, message } }, { status });
  }

  const { user, tokens } = result.value;
  const response = NextResponse.json({ user }, { status: 200 });
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken, config);
  return response;
}
