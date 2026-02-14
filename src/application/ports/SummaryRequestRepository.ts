import { EntrySummaryRequest } from "../../domain/entities/EntrySummaryRequest";

/**
 * Port for EntrySummaryRequest persistence.
 */
export interface SummaryRequestRepository {
  /**
   * Saves a new summary request.
   */
  save(request: EntrySummaryRequest): Promise<void>;

  /**
   * Finds a summary request by ID.
   */
  findById(id: string): Promise<EntrySummaryRequest | null>;

  /**
   * Finds a summary request by ID with ownership check.
   * Returns null if not found OR not owned by user.
   */
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<EntrySummaryRequest | null>;

  /**
   * Updates an existing summary request.
   */
  update(request: EntrySummaryRequest): Promise<void>;

  /**
   * Finds the latest pending or submitted request for an entry.
   * Used to check if there's already an active summary request.
   */
  findActiveByEntryId(entryId: string): Promise<EntrySummaryRequest | null>;

  /**
   * Counts active (pending or submitted) summary requests for a user.
   * Used for per-user concurrency limit.
   */
  countActiveByUserId(userId: string): Promise<number>;
}
