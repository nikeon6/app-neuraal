import { NextRequest, NextResponse } from "next/server";
import { LogoutUser } from "@/application/use-cases/auth/LogoutUser";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { clearAuthCookies } from "@/infrastructure/auth/AuthCookies";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * POST /api/auth/logout
 * Revokes refresh tokens and clears auth cookies.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  const refreshTokenRaw = request.cookies.get("refresh_token")?.value;

  if (authResult.ok) {
    const useCase = new LogoutUser(
      new PrismaRefreshTokenRepository(),
      new CryptoRefreshTokenService(),
      new SystemClock()
    );
    await useCase.execute({
      userId: authResult.userId,
      refreshTokenRaw: refreshTokenRaw ?? undefined,
    });
  }

  const config = getAuthConfig();
  const response = new NextResponse(null, { status: 204 });
  clearAuthCookies(response, config);
  return response;
}
