import { Result, ok, err } from "@/domain/core/Result";
import { Email } from "@/domain/value-objects/Email";
import type { UserRepository } from "../../ports/UserRepository";
import type { EmailVerificationTokenRepository } from "../../ports/EmailVerificationTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { EmailServicePort } from "../../ports/EmailServicePort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
} from "./verificationEmailTemplates";

export interface ResendVerificationEmailInput {
  email: string;
}

export class ResendVerificationEmail {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly verificationTtlHours: number,
    private readonly emailService: EmailServicePort | null,
    private readonly appBaseUrl: string,
  ) {}

  async execute(
    input: ResendVerificationEmailInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    const user = await this.userRepository.findByEmail(
      emailResult.value.toString(),
    );

    if (!user || user.emailVerified) {
      return ok({ ok: true });
    }

    const rawToken = this.refreshTokenService.generate();
    const tokenHash = this.refreshTokenService.hashToken(rawToken);
    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.verificationTtlHours * 60 * 60 * 1000,
    );

    await this.emailVerificationTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    if (this.emailService) {
      const verifyUrl = `${this.appBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
      try {
        await this.emailService.send({
          to: emailResult.value.toString(),
          subject: "Verify your email — Neuraal",
          html: buildVerificationEmailHtml(
            verifyUrl,
            this.verificationTtlHours,
          ),
          text: buildVerificationEmailText(
            verifyUrl,
            this.verificationTtlHours,
          ),
        });
      } catch {
        // Swallow email failures — always return generic success
      }
    }

    return ok({ ok: true });
  }
}
