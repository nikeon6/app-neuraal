import { ok } from "@/domain/core/Result";
import type { Result } from "@/domain/core/Result";
import type { StickyRepository } from "../../ports/StickyRepository";
import type { StickyDTO } from "../../dto/StickyDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { stickyToDTO } from "./stickyToDTO";

/**
 * ListStickies use case.
 * Returns all stickies for a user, sorted by sortOrder.
 */
export class ListStickies {
  constructor(private readonly repo: StickyRepository) {}

  async execute(userId: string): Promise<Result<StickyDTO[], UseCaseError>> {
    const stickies = await this.repo.findByUser(userId);
    return ok(stickies.map(stickyToDTO));
  }
}
