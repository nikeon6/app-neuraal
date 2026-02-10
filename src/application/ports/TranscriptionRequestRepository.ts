import { TranscriptionRequest } from "../../domain/entities/TranscriptionRequest";

/**
 * Port for TranscriptionRequest persistence.
 */
export interface TranscriptionRequestRepository {
  /** Saves a new transcription request. */
  save(request: TranscriptionRequest): Promise<void>;

  /** Finds a transcription request by ID. */
  findById(id: string): Promise<TranscriptionRequest | null>;

  /** Updates an existing transcription request. */
  update(request: TranscriptionRequest): Promise<void>;

  /**
   * Finds the latest pending or submitted request for an entry+youtubeUrl combo.
   * Used to check if there's already an active transcription request.
   */
  findActiveByEntryAndUrl(
    entryId: string,
    youtubeUrl: string
  ): Promise<TranscriptionRequest | null>;
}
