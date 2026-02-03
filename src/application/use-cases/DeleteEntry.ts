import { Result, ok, err } from "@/domain/core/Result";
import type { EntryRepository } from "../ports/EntryRepository";
import type { UseCaseError } from "../core/UseCaseError";
import { validationError, notFoundError } from "../core/UseCaseError";

/**
 * Input for DeleteEntry use case.
 */
export interface DeleteEntryInput {
  userId: string;
  entryId: string;
}

/**
 * DeleteEntry use case.
 * Deletes an existing entry owned by the user.
 */
export class DeleteEntry {
  constructor(private readonly entryRepository: EntryRepository) {}

  async execute(input: DeleteEntryInput): Promise<Result<void, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate entryId
    if (!input.entryId || input.entryId.trim().length === 0) {
      return err(validationError("entryId cannot be empty"));
    }

    const userId = input.userId.trim();
    const entryId = input.entryId.trim();

    // Find existing entry
    const existingEntry = await this.entryRepository.findById(entryId);

    // Check existence and ownership (return NOT_FOUND for both)
    if (!existingEntry || existingEntry.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    // Delete from repository
    await this.entryRepository.delete(entryId);

    return ok(undefined);
  }
}
