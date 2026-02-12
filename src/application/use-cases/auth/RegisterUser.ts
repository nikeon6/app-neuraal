import { Result, ok, err } from "@/domain/core/Result";
import { User } from "@/domain/entities/User";
import { Email } from "@/domain/value-objects/Email";
import { Password } from "@/domain/value-objects/Password";
import type { UserRepository } from "../../ports/UserRepository";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { PasswordHasherPort } from "../../ports/PasswordHasherPort";
import type { JwtServicePort } from "../../ports/JwtServicePort";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { AuthResultDTO } from "../../dto/AuthDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, duplicateError } from "../../core/UseCaseError";

export interface RegisterUserInput {
  email: string;
  password: string;
}

export class RegisterUser {
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

  async execute(input: RegisterUserInput): Promise<Result<AuthResultDTO, UseCaseError>> {
    // Validate email
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    // Validate password
    const passwordResult = Password.create(input.password);
    if (passwordResult.isErr()) {
      return err(validationError(passwordResult.error));
    }

    // Check uniqueness
    const existing = await this.userRepository.findByEmail(emailResult.value.toString());
    if (existing) {
      return err(duplicateError("A user with this email already exists"));
    }

    // Hash password
    const hash = await this.passwordHasher.hash(passwordResult.value.toString());

    // Create user
    const now = this.clock.now();
    const userId = crypto.randomUUID();
    const userResult = User.create({
      id: userId,
      email: emailResult.value.toString(),
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    });

    if (userResult.isErr()) {
      return err(validationError(userResult.error));
    }

    await this.userRepository.create(userResult.value);

    // Generate tokens
    const accessToken = await this.jwtService.sign(
      { sub: userId, email: emailResult.value.toString() },
      this.accessTtlSeconds
    );

    const rawRefreshToken = this.refreshTokenService.generate();
    const refreshTokenHash = this.refreshTokenService.hashToken(rawRefreshToken);

    const refreshExpiresAt = new Date(
      now.getTime() + this.refreshTtlDays * 24 * 60 * 60 * 1000
    );
    await this.refreshTokenRepository.create({
      userId,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
    });

    return ok({
      user: { id: userId, email: emailResult.value.toString() },
      tokens: { accessToken, refreshToken: rawRefreshToken },
    });
  }
}
