import { Result, ok, err } from "@/domain/core/Result";
import { Password } from "@/domain/value-objects/Password";
import type { UserRepository } from "../../ports/UserRepository";
import type { PasswordResetTokenRepository } from "../../ports/PasswordResetTokenRepository";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { PasswordHasherPort } from "../../ports/PasswordHasherPort";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, unauthorizedError } from "../../core/UseCaseError";

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
}

export class ConfirmPasswordReset {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ConfirmPasswordResetInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    const passwordResult = Password.create(input.newPassword);
    if (passwordResult.isErr()) {
      return err(validationError(passwordResult.error));
    }

    const tokenHash = this.refreshTokenService.hashToken(input.token);
    const tokenRecord =
      await this.passwordResetTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      return err(unauthorizedError("Invalid or expired reset token"));
    }

    const now = this.clock.now();

    if (tokenRecord.usedAt) {
      return err(unauthorizedError("Invalid or expired reset token"));
    }

    if (tokenRecord.expiresAt < now) {
      return err(unauthorizedError("Invalid or expired reset token"));
    }

    const user = await this.userRepository.findById(tokenRecord.userId);
    if (!user) {
      return err(unauthorizedError("Invalid or expired reset token"));
    }

    const newHash = await this.passwordHasher.hash(
      passwordResult.value.toString(),
    );

    await this.userRepository.updatePasswordHash(user.id, newHash);
    await this.passwordResetTokenRepository.markUsed(tokenHash, now);
    await this.refreshTokenRepository.revokeAllForUser(user.id, now);

    return ok({ ok: true });
  }
}
