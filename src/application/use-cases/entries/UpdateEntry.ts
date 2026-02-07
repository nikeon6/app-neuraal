import { Result, ok, err } from "@/domain/core/Result";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { EntryDTO, UpdateEntryDTO } from "../../dto/EntryDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError, conflictError } from "../../core/UseCaseError";

/**
 * Input for UpdateEntry use case.
 */
export interface UpdateEntryInput extends UpdateEntryDTO {
  userId: string;
  entryId: string;
}

/**
 * UpdateEntry use case.
 * Updates an existing entry with optimistic concurrency via version.
 */
export class UpdateEntry {
  constructor(private readonly entryRepository: EntryRepository) {}

  async execute(input: UpdateEntryInput): Promise<Result<EntryDTO, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate entryId
    if (!input.entryId || input.entryId.trim().length === 0) {
      return err(validationError("entryId cannot be empty"));
    }

    // Validate version
    if (input.version === undefined || input.version === null) {
      return err(validationError("version is required"));
    }
    if (input.version < 1) {
      return err(validationError("version must be at least 1"));
    }

    // Check that at least one field is being updated
    const hasUpdate =
      input.title !== undefined ||
      input.content !== undefined ||
      input.topicId !== undefined ||
      input.completed !== undefined ||
      input.type !== undefined;

    if (!hasUpdate) {
      return err(validationError("Must provide at least one field to update"));
    }

    const userId = input.userId.trim();
    const entryId = input.entryId.trim();

    // Find existing entry
    const existingEntry = await this.entryRepository.findById(entryId);

    // Check existence and ownership (return NOT_FOUND for both)
    if (!existingEntry || existingEntry.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    // Check version (optimistic concurrency)
    if (existingEntry.version !== input.version) {
      return err(
        conflictError(
          `Version mismatch: expected ${input.version}, current is ${existingEntry.version}`
        )
      );
    }

    // Apply updates
    const updateResult = existingEntry.withUpdates({
      title: input.title,
      content: input.content,
      topicId: input.topicId,
      completed: input.completed,
      type: input.type,
    });

    if (updateResult.isErr()) {
      return err(validationError(updateResult.error));
    }

    // Increment version
    const updatedEntry = updateResult.value.incrementVersion();

    // Save to repository
    await this.entryRepository.update(updatedEntry);

    // Return DTO
    return ok({
      id: updatedEntry.id,
      userId: updatedEntry.userId,
      date: updatedEntry.date.toString(),
      type: updatedEntry.type.toString(),
      title: updatedEntry.title.toString(),
      content: updatedEntry.content.toJSON(),
      topicId: updatedEntry.topicId,
      completed: updatedEntry.completed,
      version: updatedEntry.version,
      createdAt: updatedEntry.createdAt.toISOString(),
      updatedAt: updatedEntry.updatedAt.toISOString(),
    });
  }
}
