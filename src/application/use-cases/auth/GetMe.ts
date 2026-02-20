import { Result, ok, err } from "@/domain/core/Result";
import type { UserRepository } from "../../ports/UserRepository";
import type { UserDTO } from "../../dto/AuthDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, validationError } from "../../core/UseCaseError";

export interface GetMeInput {
  userId: string;
}

export class GetMe {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: GetMeInput): Promise<Result<UserDTO, UseCaseError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      return err(notFoundError("User not found"));
    }

    return ok({
      id: user.id,
      email: user.email.toString(),
      phoneNumber: user.phoneNumber,
    });
  }
}
