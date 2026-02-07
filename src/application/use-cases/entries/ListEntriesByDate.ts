import { Result, ok, err } from "@/domain/core/Result";
import { ISODate } from "@/domain/value-objects/ISODate";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { EntryDTO } from "../../dto/EntryDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

/**
 * Input for ListEntriesByDate use case.
 */
export interface ListEntriesByDateInput {
  userId: string;
  date: string;
}

/**
 * ListEntriesByDate use case.
 * Lists all entries for a user on a specific date.
 */
export class ListEntriesByDate {
  constructor(private readonly entryRepository: EntryRepository) {}

  async execute(
    input: ListEntriesByDateInput
  ): Promise<Result<EntryDTO[], UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate date
    const dateResult = ISODate.create(input.date);
    if (dateResult.isErr()) {
      return err(validationError(dateResult.error));
    }

    const userId = input.userId.trim();
    const date = dateResult.value.toString();

    // Fetch entries from repository
    const entries = await this.entryRepository.findByUserAndDate(userId, date);

    // Map to DTOs
    const dtos: EntryDTO[] = entries.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      date: entry.date.toString(),
      type: entry.type.toString(),
      title: entry.title.toString(),
      content: entry.content.toJSON(),
      topicId: entry.topicId,
      completed: entry.completed,
      version: entry.version,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }));

    return ok(dtos);
  }
}
