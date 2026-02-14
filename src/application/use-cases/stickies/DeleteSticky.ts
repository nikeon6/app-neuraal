import { Result, ok, err } from "@/domain/core/Result";
import type { StickyRepository } from "../../ports/StickyRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError } from "../../core/UseCaseError";

/**
 * DeleteSticky use case.
 * Deletes a sticky owned by the given user.
 */
export class DeleteSticky {
  constructor(private readonly repo: StickyRepository) {}

  async execute(
    stickyId: string,
    userId: string,
  ): Promise<Result<void, UseCaseError>> {
    const sticky = await this.repo.findById(stickyId);
    if (!sticky) {
      return err(notFoundError("Sticky not found"));
    }

    if (sticky.userId !== userId) {
      return err(notFoundError("Sticky not found"));
    }

    await this.repo.delete(stickyId);
    return ok(undefined);
  }
}
