import { NextRequest, NextResponse } from "next/server";
import { LogoutUser } from "@/application/use-cases/auth/LogoutUser";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { clearAuthCookies } from "@/infrastructure/auth/AuthCookies";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { withApiContext } from "@/infrastructure/http/withApiContext";

/**
 * POST /api/auth/logout
 * Revokes refresh tokens and clears auth cookies.
 *
 * Always attempts to revoke the refresh token, even if the access token is
 * expired/invalid. This prevents stolen refresh tokens from remaining valid
 * after the user logs out.
 */
export const POST = withApiContext(async (request: NextRequest) => {
  const authResult = await getAuthUserId(request);
  const refreshTokenRaw = request.cookies.get("refresh_token")?.value;

  const useCase = new LogoutUser(
    new PrismaRefreshTokenRepository(),
    new CryptoRefreshTokenService(),
    new SystemClock(),
  );

  if (authResult.ok) {
    // Access token valid — revoke specific refresh token or all tokens for user
    await useCase.execute({
      userId: authResult.userId,
      refreshTokenRaw: refreshTokenRaw ?? undefined,
    });
  } else if (refreshTokenRaw) {
    // Access token expired/invalid but refresh token cookie present —
    // revoke the specific refresh token by hash (no userId needed)
    await useCase.executeByRefreshToken({ refreshTokenRaw });
  }

  const config = getAuthConfig();
  const response = new NextResponse(null, { status: 204 });
  clearAuthCookies(response, config);
  return response;
});
