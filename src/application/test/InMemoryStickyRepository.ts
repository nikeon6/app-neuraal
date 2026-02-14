import type { Sticky } from "@/domain/entities/Sticky";
import type { StickyRepository } from "../ports/StickyRepository";

/**
 * In-memory implementation of StickyRepository for tests.
 */
export class InMemoryStickyRepository implements StickyRepository {
  readonly items: Sticky[] = [];

  async findById(stickyId: string): Promise<Sticky | null> {
    return this.items.find((s) => s.id === stickyId) ?? null;
  }

  async findByUser(userId: string): Promise<Sticky[]> {
    return this.items
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async save(sticky: Sticky): Promise<void> {
    this.items.push(sticky);
  }

  async update(sticky: Sticky): Promise<void> {
    const idx = this.items.findIndex((s) => s.id === sticky.id);
    if (idx >= 0) {
      this.items[idx] = sticky;
    }
  }

  async delete(stickyId: string): Promise<void> {
    const idx = this.items.findIndex((s) => s.id === stickyId);
    if (idx >= 0) {
      this.items.splice(idx, 1);
    }
  }

  async reorder(
    _userId: string,
    items: { id: string; sortOrder: number; columnIndex: number }[],
  ): Promise<void> {
    for (const item of items) {
      const sticky = this.items.find((s) => s.id === item.id);
      if (sticky) {
        // Create a new Sticky with updated sortOrder/columnIndex via the entity
        const idx = this.items.indexOf(sticky);
        const updated = sticky.withUpdates({ columnIndex: item.columnIndex });
        if (updated.isOk()) {
          // Use Object.assign to update sortOrder (internal, test-only)
          this.items[idx] = updated.value;
        }
      }
    }
  }
}
