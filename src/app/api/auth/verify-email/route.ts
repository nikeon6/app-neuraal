import { NextRequest, NextResponse } from "next/server";
import { VerifyEmail } from "@/application/use-cases/auth/VerifyEmail";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaEmailVerificationTokenRepository } from "@/infrastructure/persistence/PrismaEmailVerificationTokenRepository";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies a user's email and redirects to login.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "token query parameter is required",
        },
      },
      { status: 400 },
    );
  }

  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");

  const useCase = new VerifyEmail(
    new PrismaUserRepository(),
    new PrismaEmailVerificationTokenRepository(),
    new CryptoRefreshTokenService(),
    new SystemClock(),
  );

  const result = await useCase.execute({ token });

  if (result.isErr()) {
    const errorType = result.error.message.includes("expired")
      ? "expired"
      : "invalid";
    return NextResponse.redirect(
      `${appBaseUrl}/login?verify-error=${errorType}`,
      302,
    );
  }

  return NextResponse.redirect(`${appBaseUrl}/login?verified=true`, 302);
}
