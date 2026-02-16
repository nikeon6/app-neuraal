import { NextRequest, NextResponse } from "next/server";
import { RefreshSession } from "@/application/use-cases/auth/RefreshSession";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { JoseJwtService } from "@/infrastructure/auth/JoseJwtService";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { setAuthCookies } from "@/infrastructure/auth/AuthCookies";
import { withApiContext } from "@/infrastructure/http/withApiContext";

/**
 * POST /api/auth/refresh
 * Refreshes the session using the refresh token cookie and issues new tokens.
 */
export const POST = withApiContext(async (request: NextRequest) => {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing refresh token" } },
      { status: 401 },
    );
  }

  const config = getAuthConfig();
  const useCase = new RefreshSession(
    new PrismaUserRepository(),
    new PrismaRefreshTokenRepository(),
    new JoseJwtService(config.jwtSecret),
    new CryptoRefreshTokenService(),
    new SystemClock(),
    config.accessTtlSeconds,
    config.refreshTtlDays,
  );

  const result = await useCase.execute({ refreshToken });

  if (result.isErr()) {
    const { code, message } = result.error;
    return NextResponse.json({ error: { code, message } }, { status: 401 });
  }

  const { tokens } = result.value;
  const response = NextResponse.json({ ok: true }, { status: 200 });
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken, config);
  return response;
});
