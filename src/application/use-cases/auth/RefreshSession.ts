import { Result, ok, err } from "@/domain/core/Result";
import type { UserRepository } from "../../ports/UserRepository";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { JwtServicePort } from "../../ports/JwtServicePort";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { AuthResultDTO } from "../../dto/AuthDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { unauthorizedError } from "../../core/UseCaseError";

export interface RefreshSessionInput {
  refreshToken: string;
}

export class RefreshSession {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtServicePort,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlDays: number,
  ) {}

  async execute(input: RefreshSessionInput): Promise<Result<AuthResultDTO, UseCaseError>> {
    const tokenHash = this.refreshTokenService.hashToken(input.refreshToken);

    const storedToken = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (!storedToken) {
      return err(unauthorizedError("Invalid or expired refresh token"));
    }

    const now = this.clock.now();

    if (storedToken.revokedAt) {
      await this.refreshTokenRepository.revokeAllForUser(storedToken.userId, now);
      return err(unauthorizedError("Token reuse detected"));
    }

    if (storedToken.expiresAt <= now) {
      return err(unauthorizedError("Invalid or expired refresh token"));
    }

    const user = await this.userRepository.findById(storedToken.userId);
    if (!user) {
      return err(unauthorizedError("Invalid or expired refresh token"));
    }

    const rawRefreshToken = this.refreshTokenService.generate();
    const newRefreshTokenHash = this.refreshTokenService.hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date(
      now.getTime() + this.refreshTtlDays * 24 * 60 * 60 * 1000
    );

    await this.refreshTokenRepository.rotateToken(
      tokenHash,
      {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
      now
    );

    const accessToken = await this.jwtService.sign(
      { sub: user.id, email: user.email.toString() },
      this.accessTtlSeconds
    );

    return ok({
      user: { id: user.id, email: user.email.toString() },
      tokens: { accessToken, refreshToken: rawRefreshToken },
    });
  }
}
