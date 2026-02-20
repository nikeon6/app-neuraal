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
    format: SummaryFormat,
  ): Promise<void>;

  /**
   * Clears the AI-generated summary from an entry.
   */
  clearSummary(entryId: string): Promise<void>;

  /**
   * Updates the raw JSON content of an entry.
   * Used by transcription callback to inject transcription into Tiptap doc.
   */
  updateContent(
    entryId: string,
    content: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Updates the transcript text of an entry.
   * Used by the transcription callback handler.
   */
  updateTranscript(entryId: string, transcriptText: string): Promise<void>;

  /**
   * Updates the topicId of an entry.
   * Used by auto-topic assignment.
   */
  updateTopic(entryId: string, topicId: string | null): Promise<void>;

  /**
   * Clears topic assignment for all entries owned by userId that point to topicId.
   * Used by topic deletion to keep entries in "No topic" state.
   * Scoped to userId to prevent cross-tenant data mutation.
   */
  clearTopicFromEntries(userId: string, topicId: string): Promise<void>;

  /**
   * Returns the next available sortOrder for a user+date.
   * If no entries exist for that day, returns 0.
   */
  getNextSortOrder(userId: string, date: string): Promise<number>;

  /**
   * Bulk-updates sort_order for entries on a given user+date.
   * orderedIds[0] gets sortOrder=0, orderedIds[1] gets sortOrder=1, etc.
   */
  reorderEntries(
    userId: string,
    date: string,
    orderedIds: string[],
  ): Promise<void>;
}
