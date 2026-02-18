import { Result, ok, err } from "@/domain/core/Result";
import { Password } from "@/domain/value-objects/Password";
import type { UserRepository } from "../../ports/UserRepository";
import type { RefreshTokenRepository } from "../../ports/RefreshTokenRepository";
import type { PasswordHasherPort } from "../../ports/PasswordHasherPort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  validationError,
  unauthorizedError,
  notFoundError,
} from "../../core/UseCaseError";

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePassword {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ChangePasswordInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId is required"));
    }

    const newPasswordResult = Password.create(input.newPassword);
    if (newPasswordResult.isErr()) {
      return err(validationError(newPasswordResult.error));
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      return err(notFoundError("User not found"));
    }

    const isCurrentValid = await this.passwordHasher.verify(
      input.currentPassword,
      user.passwordHash.toString(),
    );
    if (!isCurrentValid) {
      return err(unauthorizedError("Current password is incorrect"));
    }

    const newHash = await this.passwordHasher.hash(
      newPasswordResult.value.toString(),
    );

    const now = this.clock.now();

    await this.userRepository.updatePasswordHash(user.id, newHash);
    await this.refreshTokenRepository.revokeAllForUser(user.id, now);

    return ok({ ok: true });
  }
}
