import { Result, ok, err } from "@/domain/core/Result";
import { ISODate } from "@/domain/value-objects/ISODate";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

/**
 * Input for ReorderEntries use case.
 */
export interface ReorderEntriesInput {
  userId: string;
  date: string;
  /** Entry IDs in the desired display order (index 0 = first). */
  orderedIds: string[];
}

/**
 * ReorderEntries use case.
 * Bulk-updates sortOrder for all entries on a user+date.
 * Does NOT bump entry version (reorder is a lightweight operation).
 */
export class ReorderEntries {
  constructor(private readonly entryRepository: EntryRepository) {}

  async execute(
    input: ReorderEntriesInput
  ): Promise<Result<void, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate date
    const dateResult = ISODate.create(input.date);
    if (dateResult.isErr()) {
      return err(validationError(dateResult.error));
    }

    // Validate orderedIds
    if (!Array.isArray(input.orderedIds) || input.orderedIds.length === 0) {
      return err(validationError("orderedIds must be a non-empty array"));
    }

    // Check for duplicates
    const uniqueIds = new Set(input.orderedIds);
    if (uniqueIds.size !== input.orderedIds.length) {
      return err(validationError("orderedIds must not contain duplicates"));
    }

    const userId = input.userId.trim();
    const date = dateResult.value.toString();

    // Verify all IDs belong to this user+date
    const entries = await this.entryRepository.findByUserAndDate(userId, date);
    const existingIds = new Set(entries.map((e) => e.id));

    for (const id of input.orderedIds) {
      if (!existingIds.has(id)) {
        return err(
          validationError(
            `Entry ${id} does not belong to user ${userId} on date ${date}`
          )
        );
      }
    }

    // Perform the reorder
    await this.entryRepository.reorderEntries(userId, date, input.orderedIds);

    return ok(undefined);
  }
}
