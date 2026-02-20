import { NextRequest, NextResponse } from "next/server";
import { ConfirmPasswordReset } from "@/application/use-cases/auth/ConfirmPasswordReset";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaPasswordResetTokenRepository } from "@/infrastructure/persistence/PrismaPasswordResetTokenRepository";
import { PrismaRefreshTokenRepository } from "@/infrastructure/persistence/PrismaRefreshTokenRepository";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";

/**
 * POST /api/auth/reset-password
 * Confirms a password reset with { token, newPassword }.
 * Returns 200 { ok: true } on success, 400 for validation, 401 for invalid/expired token.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "token is required" } },
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

  const useCase = new ConfirmPasswordReset(
    new PrismaUserRepository(),
    new PrismaPasswordResetTokenRepository(),
    new PrismaRefreshTokenRepository(),
    new BcryptPasswordHasher(),
    new CryptoRefreshTokenService(),
    new SystemClock(),
  );

  const result = await useCase.execute({
    token: body.token,
    newPassword: body.newPassword,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    if (code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: { code, message } }, { status: 400 });
    }
    if (code === "UNAUTHORIZED") {
      return NextResponse.json({ error: { code, message } }, { status: 401 });
    }
    return NextResponse.json({ error: { code, message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
