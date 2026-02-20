import { Result, ok, err } from "@/domain/core/Result";
import { buildEmailDocument, emailBody, LOGO_CID } from "./emailLayout";
import { Email } from "@/domain/value-objects/Email";
import type { UserRepository } from "../../ports/UserRepository";
import type { PasswordResetTokenRepository } from "../../ports/PasswordResetTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { EmailServicePort } from "../../ports/EmailServicePort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

export interface RequestPasswordResetInput {
  email: string;
}

export class RequestPasswordReset {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly resetTtlMinutes: number,
    private readonly emailService: EmailServicePort | null,
    private readonly appBaseUrl: string,
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    const user = await this.userRepository.findByEmail(
      emailResult.value.toString(),
    );

    if (user) {
      const rawToken = this.refreshTokenService.generate();
      const tokenHash = this.refreshTokenService.hashToken(rawToken);
      const now = this.clock.now();
      const expiresAt = new Date(
        now.getTime() + this.resetTtlMinutes * 60 * 1000,
      );

      await this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      if (this.emailService) {
        const resetUrl = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
        try {
          await this.emailService.send({
            to: emailResult.value.toString(),
            subject: "Reset your password — Neuraal",
            html: buildResetEmailHtml(resetUrl, this.resetTtlMinutes),
            text: buildResetEmailText(resetUrl, this.resetTtlMinutes),
          });
        } catch {
          // Keep recover flow semantics: always return generic success.
        }
      }
    }

    return ok({ ok: true });
  }
}

function buildResetEmailHtml(resetUrl: string, ttlMinutes: number): string {
  const body = emailBody({
    logoSrc: `cid:${LOGO_CID}`,
    heading: "Reset your password",
    paragraph:
      "We received a request to reset your password. Click the button below to choose a new one.",
    buttonUrl: resetUrl,
    buttonLabel: "Reset password",
    footnote: `This link expires in ${ttlMinutes} minutes. If you didn&#8217;t request this, you can safely ignore this email.`,
  });

  return buildEmailDocument("Reset your password", body);
}

function buildResetEmailText(resetUrl: string, ttlMinutes: number): string {
  return [
    "Reset your password",
    "",
    "We received a request to reset your password.",
    "Visit the following link to choose a new one:",
    "",
    resetUrl,
    "",
    `This link expires in ${ttlMinutes} minutes.`,
    "If you didn't request this, you can safely ignore this email.",
    "",
    "— Neuraal",
  ].join("\n");
}
