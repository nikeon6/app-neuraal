import type { Entry } from "@/domain/entities/Entry";
import type { SummaryFormat } from "@/domain/value-objects/SummaryText";

/**
 * Port (interface) for Entry persistence.
 * Infrastructure layer will provide the concrete implementation.
 */
export interface EntryRepository {
  /**
   * Finds an entry by id.
   */
  findById(entryId: string): Promise<Entry | null>;

  /**
   * Finds all entries for a user on a specific date.
   */
  findByUserAndDate(userId: string, date: string): Promise<Entry[]>;

  /**
   * Saves a new entry.
   */
  save(entry: Entry): Promise<void>;

  /**
   * Updates an existing entry.
   */
  update(entry: Entry): Promise<void>;

  /**
   * Deletes an entry by id.
   */
  delete(entryId: string): Promise<void>;

  /**
   * Updates the summary of an entry.
   * Used by the summary callback handler.
   */
  updateSummary(
    entryId: string,
    summary: string,
    format: SummaryFormat
  ): Promise<void>;
}
