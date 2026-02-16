import { NextRequest, NextResponse } from "next/server";
import { LoginUser } from "@/application/use-cases/auth/LoginUser";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { JoseJwtService } from "@/infrastructure/auth/JoseJwtService";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { setAuthCookies } from "@/infrastructure/auth/AuthCookies";
import { loginRateLimiter } from "@/infrastructure/auth/LoginRateLimiter";
import { withApiContext } from "@/infrastructure/http/withApiContext";
import type { UseCaseErrorCode } from "@/application/core/UseCaseError";

function errorCodeToStatus(code: UseCaseErrorCode): number {
  const map: Record<UseCaseErrorCode, number> = {
    VALIDATION_ERROR: 400,
    DUPLICATE_ERROR: 409,
    UNAUTHORIZED: 401,
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
 * Extracts the client IP from the request.
 * Uses x-forwarded-for (reverse proxy) or falls back to "unknown".
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Next.js doesn't expose raw socket IP directly, use a fallback
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/auth/login
 * Authenticates a user and returns auth cookies.
 * Rate-limited: 5 failed attempts per IP → 5 minute lockout.
 */
export const POST = withApiContext(async (request: NextRequest) => {
  const clientIp = getClientIp(request);

  // --- Rate limit check ---
  const rateLimitCheck = loginRateLimiter.check(clientIp);
  if (!rateLimitCheck.allowed) {
    const retryAfterSeconds = Math.ceil(
      (rateLimitCheck.retryAfterMs ?? 300_000) / 1000,
    );
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: `Too many login attempts. Please try again in ${retryAfterSeconds} seconds.`,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "email and password are required",
        },
      },
      { status: 400 },
    );
  }

  const config = getAuthConfig();
  const useCase = new LoginUser(
    new PrismaUserRepository(),
    new PrismaRefreshTokenRepository(),
    new BcryptPasswordHasher(),
    new JoseJwtService(config.jwtSecret),
    new CryptoRefreshTokenService(),
    new SystemClock(),
    config.accessTtlSeconds,
    config.refreshTtlDays,
  );

  const result = await useCase.execute({
    email: body.email,
    password: body.password,
  });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Record failed attempt for rate limiting (only for auth failures)
    if (code === "UNAUTHORIZED") {
      const rateLimitResult = loginRateLimiter.recordFailure(clientIp);
      const status = errorCodeToStatus(code);

      // If this failure triggered a lockout, return 429 with info
      if (!rateLimitResult.allowed) {
        const retryAfterSeconds = Math.ceil(
          (rateLimitResult.retryAfterMs ?? 300_000) / 1000,
        );
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: `Too many login attempts. Please try again in ${retryAfterSeconds} seconds.`,
            },
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfterSeconds),
            },
          },
        );
      }

      // Return the auth error with remaining attempts hint
      return NextResponse.json(
        { error: { code, message } },
        {
          status,
          headers: {
            "X-RateLimit-Remaining": String(
              rateLimitResult.remainingAttempts ?? 0,
            ),
          },
        },
      );
    }

    const status = errorCodeToStatus(code);
    return NextResponse.json({ error: { code, message } }, { status });
  }

  // --- Successful login: clear rate limit for this IP ---
  loginRateLimiter.recordSuccess(clientIp);

  const { user, tokens } = result.value;
  const response = NextResponse.json({ user }, { status: 200 });
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken, config);
  return response;
});
