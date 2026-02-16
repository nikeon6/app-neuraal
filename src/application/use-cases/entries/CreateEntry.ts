import { Result, ok, err } from "@/domain/core/Result";
import { Entry } from "@/domain/entities/Entry";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { CreateEntryDTO, EntryDTO } from "../../dto/EntryDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";
import crypto from "node:crypto";

/**
 * Input for CreateEntry use case.
 */
export type CreateEntryInput = CreateEntryDTO;

/**
 * Generates a unique ID for an entry.
 */
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

/**
 * CreateEntry use case.
 * Creates a new entry (task or note) for a user.
 */
export class CreateEntry {
  constructor(private readonly entryRepository: EntryRepository) {}

  async execute(
    input: CreateEntryInput,
  ): Promise<Result<EntryDTO, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Determine completed value based on type
    let completed: boolean | null = null;
    if (input.type === "task") {
      completed = input.completed ?? false;
    } else if (input.type === "note" && input.completed !== undefined) {
      return err(validationError("completed field cannot be set for notes"));
    }

    const now = new Date();

    // Create entry entity (validates all fields)
    const entryResult = Entry.create({
      id: generateId(),
      userId: input.userId.trim(),
      date: input.date,
      type: input.type,
      title: input.title,
      content: input.content,
      topicId: input.topicId ?? null,
      completed,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    if (entryResult.isErr()) {
      return err(validationError(entryResult.error));
    }

    const entry = entryResult.value;

    // Save to repository
    await this.entryRepository.save(entry);

    // Return DTO
    return ok({
      id: entry.id,
      userId: entry.userId,
      date: entry.date.toString(),
      type: entry.type.toString(),
      title: entry.title.toString(),
      content: entry.content.toJSON(),
      topicId: entry.topicId,
      completed: entry.completed,
      version: entry.version,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      summary: entry.summary,
      summaryFormat: entry.summaryFormat,
      summaryUpdatedAt: entry.summaryUpdatedAt?.toISOString() ?? null,
    });
  }
}
