import { Result, ok, err } from "@/domain/core/Result";
import { User } from "@/domain/entities/User";
import { Email } from "@/domain/value-objects/Email";
import { Password } from "@/domain/value-objects/Password";
import type { UserRepository } from "../../ports/UserRepository";
import type { EmailVerificationTokenRepository } from "../../ports/EmailVerificationTokenRepository";
import type { PasswordHasherPort } from "../../ports/PasswordHasherPort";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { EmailServicePort } from "../../ports/EmailServicePort";
import type { RegisterResultDTO } from "../../dto/AuthDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, duplicateError } from "../../core/UseCaseError";
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
} from "./verificationEmailTemplates";

export interface RegisterUserInput {
  email: string;
  password: string;
}

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly emailService: EmailServicePort | null,
    private readonly appBaseUrl: string,
    private readonly verificationTtlHours: number,
  ) {}

  async execute(
    input: RegisterUserInput,
  ): Promise<Result<RegisterResultDTO, UseCaseError>> {
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    const passwordResult = Password.create(input.password);
    if (passwordResult.isErr()) {
      return err(validationError(passwordResult.error));
    }

    const existing = await this.userRepository.findByEmail(
      emailResult.value.toString(),
    );
    if (existing) {
      return err(duplicateError("A user with this email already exists"));
    }

    const hash = await this.passwordHasher.hash(
      passwordResult.value.toString(),
    );

    const now = this.clock.now();
    const userId = crypto.randomUUID();
    const userResult = User.create({
      id: userId,
      email: emailResult.value.toString(),
      passwordHash: hash,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    if (userResult.isErr()) {
      return err(validationError(userResult.error));
    }

    await this.userRepository.create(userResult.value);

    const rawToken = this.refreshTokenService.generate();
    const tokenHash = this.refreshTokenService.hashToken(rawToken);
    const expiresAt = new Date(
      now.getTime() + this.verificationTtlHours * 60 * 60 * 1000,
    );

    await this.emailVerificationTokenRepository.create({
      userId,
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
            this.appBaseUrl,
          ),
          text: buildVerificationEmailText(
            verifyUrl,
            this.verificationTtlHours,
          ),
        });
      } catch {
        // Swallow email failures — user is created, they can resend later
      }
    }

    return ok({
      user: { id: userId, email: emailResult.value.toString() },
      message:
        "Please check your email to verify your account before logging in",
    });
  }
}
