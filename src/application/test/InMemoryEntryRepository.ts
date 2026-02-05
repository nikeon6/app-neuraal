import type { Entry } from "@/domain/entities/Entry";
import type { EntryRepository } from "../ports/EntryRepository";
import type { SummaryFormat } from "@/domain/value-objects/SummaryText";

/**
 * Summary data stored alongside entries in tests.
 */
interface EntrySummaryData {
  summary: string;
  format: SummaryFormat;
  updatedAt: Date;
}

/**
 * In-memory implementation of EntryRepository for testing.
 * Does not depend on Prisma or any external service.
 */
export class InMemoryEntryRepository implements EntryRepository {
  private entries: Entry[] = [];
  private summaries: Map<string, EntrySummaryData> = new Map();

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
    this.summaries.delete(entryId);
  }

  async updateSummary(
    entryId: string,
    summary: string,
    format: SummaryFormat
  ): Promise<void> {
    this.summaries.set(entryId, {
      summary,
      format,
      updatedAt: new Date(),
    });
  }

  /**
   * Helper for tests: clear all entries.
   */
  clear(): void {
    this.entries = [];
    this.summaries.clear();
  }

  /**
   * Helper for tests: get all entries.
   */
  getAll(): Entry[] {
    return [...this.entries];
  }

  /**
   * Helper for tests: get summary for an entry.
   */
  getSummary(entryId: string): EntrySummaryData | undefined {
    return this.summaries.get(entryId);
  }
}
