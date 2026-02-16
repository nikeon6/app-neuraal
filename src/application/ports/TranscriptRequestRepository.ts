/**
 * Data for a transcript request record.
 */
export interface TranscriptRequestData {
  id: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
  status: string; // "pending" | "submitted" | "done" | "failed"
  meta?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date | null;
  doneAt?: Date | null;
  failedAt?: Date | null;
}

/**
 * Port for TranscriptRequest persistence.
 */
export interface TranscriptRequestRepository {
  create(
    data: Omit<
      TranscriptRequestData,
      "updatedAt" | "submittedAt" | "doneAt" | "failedAt"
    >,
  ): Promise<TranscriptRequestData>;
  findById(id: string): Promise<TranscriptRequestData | null>;
  findActiveByEntryId(entryId: string): Promise<TranscriptRequestData | null>;
  countActiveByUserId(userId: string): Promise<number>;
  markSubmitted(id: string, now: Date): Promise<void>;
  markDone(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void>;
  markFailed(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void>;
}
