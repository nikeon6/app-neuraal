import { Result, ok, err } from "@/domain/core/Result";
import type { UserRepository } from "../../ports/UserRepository";
import type { EmailVerificationTokenRepository } from "../../ports/EmailVerificationTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { unauthorizedError } from "../../core/UseCaseError";

const INVALID_TOKEN_MSG = "Invalid or expired verification token";

export interface VerifyEmailInput {
  token: string;
}

export class VerifyEmail {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: VerifyEmailInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    const tokenHash = this.refreshTokenService.hashToken(input.token);
    const tokenRecord =
      await this.emailVerificationTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      return err(unauthorizedError(INVALID_TOKEN_MSG));
    }

    if (tokenRecord.usedAt) {
      return err(unauthorizedError(INVALID_TOKEN_MSG));
    }

    const now = this.clock.now();

    if (tokenRecord.expiresAt < now) {
      return err(unauthorizedError(INVALID_TOKEN_MSG));
    }

    const user = await this.userRepository.findById(tokenRecord.userId);
    if (!user) {
      return err(unauthorizedError(INVALID_TOKEN_MSG));
    }

    await this.userRepository.markEmailVerified(user.id);
    await this.emailVerificationTokenRepository.markUsed(tokenHash, now);

    return ok({ ok: true });
  }
}
