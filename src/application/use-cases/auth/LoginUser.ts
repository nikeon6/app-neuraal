import { Result, ok, err } from "@/domain/core/Result";
import { Email } from "@/domain/value-objects/Email";
import type { UserRepository } from "../../ports/UserRepository";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { PasswordHasherPort } from "../../ports/PasswordHasherPort";
import type { JwtServicePort } from "../../ports/JwtServicePort";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { AuthResultDTO } from "../../dto/AuthDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, unauthorizedError } from "../../core/UseCaseError";

const INVALID_CREDENTIALS_MSG = "Invalid email or password";

export interface LoginUserInput {
  email: string;
  password: string;
}

export class LoginUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtServicePort,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlDays: number,
  ) {}

  async execute(
    input: LoginUserInput,
  ): Promise<Result<AuthResultDTO, UseCaseError>> {
    // Validate email format
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    const email = emailResult.value.toString();

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return err(unauthorizedError(INVALID_CREDENTIALS_MSG));
    }

    // Verify password
    const isValid = await this.passwordHasher.verify(
      input.password,
      user.passwordHash.toString(),
    );
    if (!isValid) {
      return err(unauthorizedError(INVALID_CREDENTIALS_MSG));
    }

    // Generate tokens
    const now = this.clock.now();
    const accessToken = await this.jwtService.sign(
      { sub: user.id, email },
      this.accessTtlSeconds,
    );

    const rawRefreshToken = this.refreshTokenService.generate();
    const refreshTokenHash =
      this.refreshTokenService.hashToken(rawRefreshToken);

    const refreshExpiresAt = new Date(
      now.getTime() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
    });

    return ok({
      user: { id: user.id, email },
      tokens: { accessToken, refreshToken: rawRefreshToken },
    });
  }
}
