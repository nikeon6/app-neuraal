import { Result, ok, err } from "@/domain/core/Result";
import type { StickyRepository } from "../../ports/StickyRepository";
import type { UpdateStickyDTO, StickyDTO } from "../../dto/StickyDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError, conflictError } from "../../core/UseCaseError";
import { stickyToDTO } from "../../dto/stickyToDTO";

/**
 * UpdateSticky use case.
 * Updates an existing sticky with optimistic concurrency.
 */
export class UpdateSticky {
  constructor(private readonly repo: StickyRepository) {}

  async execute(
    stickyId: string,
    userId: string,
    input: UpdateStickyDTO
  ): Promise<Result<StickyDTO, UseCaseError>> {
    const sticky = await this.repo.findById(stickyId);
    if (!sticky) {
      return err(notFoundError("Sticky not found"));
    }

    if (sticky.userId !== userId) {
      return err(notFoundError("Sticky not found"));
    }

    // Optimistic concurrency check
    if (sticky.version !== input.version) {
      return err(conflictError("Version mismatch"));
    }

    const updated = sticky.withUpdates({
      title: input.title,
      content: input.content,
      columnIndex: input.columnIndex,
    });

    if (updated.isErr()) {
      return err(validationError(updated.error));
    }

    const bumped = updated.value.incrementVersion();
    await this.repo.update(bumped);
    return ok(stickyToDTO(bumped));
  }
}
