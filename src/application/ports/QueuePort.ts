/**
 * Data for enqueuing a reminder job.
 */
export interface EnqueueReminderData {
  reminderId: string;
  scheduledAt: string;
}

/**
 * Data for enqueuing an entry summary job.
 */
export interface EnqueueEntrySummaryData {
  requestId: string;
  userId: string;
  entryId: string;
}

/**
 * Port for job queue operations.
 */
export interface QueuePort {
  /**
   * Enqueues a reminder job to be processed at scheduledAt.
   * The job will have a delay calculated from scheduledAt - now.
   * Uses reminderId as jobId for idempotency.
   */
  enqueueReminder(data: EnqueueReminderData): Promise<void>;

  /**
   * Enqueues an entry summary job to be processed immediately.
   * Uses requestId as jobId for idempotency.
   */
  enqueueEntrySummary(data: EnqueueEntrySummaryData): Promise<void>;
}
