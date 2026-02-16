import { Result, ok, err } from "@/domain/core/Result";
import { Email } from "@/domain/value-objects/Email";
import type { UserRepository } from "../../ports/UserRepository";
import type { PasswordResetTokenRepository } from "../../ports/PasswordResetTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
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
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    // Validate email format
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    // Always return ok, even if user doesn't exist (prevent email enumeration)
    const user = await this.userRepository.findByEmail(
      emailResult.value.toString(),
    );

    if (user) {
      // Generate token
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

      // TODO: Send email with rawToken when email provider is available
    }

    return ok({ ok: true });
  }
}
