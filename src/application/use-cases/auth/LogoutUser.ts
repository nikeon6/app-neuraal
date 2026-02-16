import { Result, ok, err } from "@/domain/core/Result";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

export interface LogoutUserInput {
  userId: string;
  refreshTokenRaw?: string;
}

export interface LogoutByRefreshTokenInput {
  refreshTokenRaw: string;
}

export class LogoutUser {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: LogoutUserInput): Promise<Result<void, UseCaseError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    const now = this.clock.now();

    if (input.refreshTokenRaw) {
      // Revoke specific token
      const tokenHash = this.refreshTokenService.hashToken(
        input.refreshTokenRaw,
      );
      await this.refreshTokenRepository.revokeByTokenHash(tokenHash, now);
    } else {
      // Revoke all tokens for user
      await this.refreshTokenRepository.revokeAllForUser(input.userId, now);
    }

    return ok(undefined);
  }

  /**
   * Revokes a refresh token by its raw value without requiring a valid userId.
   * Used when the access token has expired but the refresh token cookie is still present.
   */
  async executeByRefreshToken(
    input: LogoutByRefreshTokenInput,
  ): Promise<Result<void, UseCaseError>> {
    if (!input.refreshTokenRaw || input.refreshTokenRaw.trim().length === 0) {
      return err(validationError("refreshTokenRaw cannot be empty"));
    }

    const now = this.clock.now();
    const tokenHash = this.refreshTokenService.hashToken(input.refreshTokenRaw);
    await this.refreshTokenRepository.revokeByTokenHash(tokenHash, now);

    return ok(undefined);
  }
}
