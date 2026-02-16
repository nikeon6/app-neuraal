import type { Sticky } from "@/domain/entities/Sticky";

/**
 * Port (interface) for Sticky persistence.
 * Infrastructure layer will provide the concrete implementation.
 */
export interface StickyRepository {
  /** Finds a sticky by id. */
  findById(stickyId: string): Promise<Sticky | null>;

  /** Finds all stickies for a user, ordered by sortOrder ASC. */
  findByUser(userId: string): Promise<Sticky[]>;

  /** Saves a new sticky. */
  save(sticky: Sticky): Promise<void>;

  /** Updates an existing sticky. */
  update(sticky: Sticky): Promise<void>;

  /** Deletes a sticky by id. */
  delete(stickyId: string): Promise<void>;

  /**
   * Bulk-updates sortOrder and columnIndex for a user's stickies.
   * Each item has { id, sortOrder, columnIndex }.
   */
  reorder(
    userId: string,
    items: { id: string; sortOrder: number; columnIndex: number }[],
  ): Promise<void>;
}
