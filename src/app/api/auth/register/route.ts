import { NextRequest, NextResponse } from "next/server";
import { RegisterUser } from "@/application/use-cases/auth/RegisterUser";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaEmailVerificationTokenRepository } from "@/infrastructure/persistence/PrismaEmailVerificationTokenRepository";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { SmtpEmailService } from "@/infrastructure/email/SmtpEmailService";
import { getEmailConfig } from "@/infrastructure/email/EmailConfig";
import type { EmailServicePort } from "@/application/ports/EmailServicePort";
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

function tryBuildEmailService(): EmailServicePort | null {
  try {
    const emailConfig = getEmailConfig();
    return new SmtpEmailService(emailConfig);
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/register
 * Registers a new user and sends a verification email.
 * Returns 201 with a message to check email.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const useCase = new RegisterUser(
    new PrismaUserRepository(),
    new BcryptPasswordHasher(),
    new CryptoRefreshTokenService(),
    new SystemClock(),
    new PrismaEmailVerificationTokenRepository(),
    tryBuildEmailService(),
    config.appBaseUrl,
    config.verificationTtlHours,
  );

  const result = await useCase.execute({
    email: body.email,
    password: body.password,
  });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = errorCodeToStatus(code);
    return NextResponse.json({ error: { code, message } }, { status });
  }

  const { user, message } = result.value;
  return NextResponse.json({ user, message }, { status: 201 });
}
