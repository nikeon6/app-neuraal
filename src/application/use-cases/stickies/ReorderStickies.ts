import { Result, ok, err } from "@/domain/core/Result";
import type { StickyRepository } from "../../ports/StickyRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

export interface ReorderItem {
  id: string;
  sortOrder: number;
  columnIndex: number;
}

/**
 * ReorderStickies use case.
 * Bulk-updates sortOrder and columnIndex for a user's stickies.
 */
export class ReorderStickies {
  constructor(private readonly repo: StickyRepository) {}

  async execute(
    userId: string,
    items: readonly ReorderItem[]
  ): Promise<Result<void, UseCaseError>> {
    if (items.length === 0) {
      return err(validationError("items cannot be empty"));
    }

    // Validate all columnIndex values
    for (const item of items) {
      if (item.columnIndex !== 0 && item.columnIndex !== 1) {
        return err(validationError("columnIndex must be 0 or 1"));
      }
    }

    await this.repo.reorder(
      userId,
      items.map((i) => ({ id: i.id, sortOrder: i.sortOrder, columnIndex: i.columnIndex }))
    );
    return ok(undefined);
  }
}
