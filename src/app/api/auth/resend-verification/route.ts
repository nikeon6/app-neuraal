import { NextRequest, NextResponse } from "next/server";
import { ResendVerificationEmail } from "@/application/use-cases/auth/ResendVerificationEmail";
import { PrismaUserRepository } from "@/infrastructure/persistence/PrismaUserRepository";
import { PrismaEmailVerificationTokenRepository } from "@/infrastructure/persistence/PrismaEmailVerificationTokenRepository";
import { CryptoRefreshTokenService } from "@/infrastructure/auth/CryptoRefreshTokenService";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthConfig } from "@/infrastructure/auth/AuthConfig";
import { SmtpEmailService } from "@/infrastructure/email/SmtpEmailService";
import { getEmailConfig } from "@/infrastructure/email/EmailConfig";
import type { EmailServicePort } from "@/application/ports/EmailServicePort";

function tryBuildEmailService(): EmailServicePort | null {
  try {
    const emailConfig = getEmailConfig();
    return new SmtpEmailService(emailConfig);
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/resend-verification
 * Resends the email verification link.
 * Always returns 200 to prevent email enumeration.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "email is required" } },
      { status: 400 },
    );
  }

  const config = getAuthConfig();

  const useCase = new ResendVerificationEmail(
    new PrismaUserRepository(),
    new PrismaEmailVerificationTokenRepository(),
    new CryptoRefreshTokenService(),
    new SystemClock(),
    config.verificationTtlHours,
    tryBuildEmailService(),
    config.appBaseUrl,
  );

  const result = await useCase.execute({ email: body.email });

  if (result.isErr()) {
    const { code, message } = result.error;
    if (code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: { code, message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code, message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
