import { Result, ok, err } from "@/domain/core/Result";
import { Sticky } from "@/domain/entities/Sticky";
import type { StickyRepository } from "../../ports/StickyRepository";
import type { CreateStickyDTO, StickyDTO } from "../../dto/StickyDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";
import { stickyToDTO } from "../../dto/stickyToDTO";

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * CreateSticky use case.
 * Creates a new sticky for a user.
 */
export class CreateSticky {
  constructor(private readonly repo: StickyRepository) {}

  async execute(
    input: CreateStickyDTO,
  ): Promise<Result<StickyDTO, UseCaseError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    const now = new Date();

    const result = Sticky.create({
      id: generateId(),
      userId: input.userId.trim(),
      title: input.title,
      content: input.content,
      version: 1,
      columnIndex: input.columnIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    if (result.isErr()) {
      return err(validationError(result.error));
    }

    await this.repo.save(result.value);
    return ok(stickyToDTO(result.value));
  }
}
