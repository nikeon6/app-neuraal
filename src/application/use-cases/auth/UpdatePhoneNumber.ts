import { Result, ok, err } from "@/domain/core/Result";
import type { UserRepository } from "../../ports/UserRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, validationError } from "../../core/UseCaseError";

export interface UpdatePhoneNumberInput {
  userId: string;
  phoneNumber: string | null;
}

export interface UpdatePhoneNumberOutput {
  phoneNumber: string | null;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function normalizePhoneNumber(raw: string): string {
  return raw.replaceAll(/[\s\-()]/g, "");
}

export class UpdatePhoneNumber {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    input: UpdatePhoneNumberInput,
  ): Promise<Result<UpdatePhoneNumberOutput, UseCaseError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    let phoneNumber: string | null = input.phoneNumber;

    if (phoneNumber !== null && phoneNumber.trim() === "") {
      phoneNumber = null;
    }

    if (phoneNumber !== null) {
      phoneNumber = normalizePhoneNumber(phoneNumber);

      if (!E164_REGEX.test(phoneNumber)) {
        return err(
          validationError(
            "Invalid phone number format. Use international format, e.g. +34612345678",
          ),
        );
      }
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      return err(notFoundError("User not found"));
    }

    await this.userRepository.updatePhoneNumber(input.userId, phoneNumber);

    return ok({ phoneNumber });
  }
}
