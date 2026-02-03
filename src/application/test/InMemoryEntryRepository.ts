import type { Entry } from "@/domain/entities/Entry";
import type { EntryRepository } from "../ports/EntryRepository";

/**
 * In-memory implementation of EntryRepository for testing.
 * Does not depend on Prisma or any external service.
 */
export class InMemoryEntryRepository implements EntryRepository {
  private entries: Entry[] = [];

  async findById(entryId: string): Promise<Entry | null> {
    return this.entries.find((e) => e.id === entryId) ?? null;
  }

  async findByUserAndDate(userId: string, date: string): Promise<Entry[]> {
    return this.entries.filter(
      (e) => e.userId === userId && e.date.toString() === date
    );
  }

  async save(entry: Entry): Promise<void> {
    this.entries.push(entry);
  }

  async update(entry: Entry): Promise<void> {
    const index = this.entries.findIndex((e) => e.id === entry.id);
    if (index !== -1) {
      this.entries[index] = entry;
    }
  }

  async delete(entryId: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== entryId);
  }

  /**
   * Helper for tests: clear all entries.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Helper for tests: get all entries.
   */
  getAll(): Entry[] {
    return [...this.entries];
  }
}
