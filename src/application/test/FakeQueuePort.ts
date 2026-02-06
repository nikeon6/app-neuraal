import {
  QueuePort,
  EnqueueReminderData,
  EnqueueEntrySummaryData,
} from "../ports/QueuePort";

/**
 * Fake implementation of QueuePort for testing.
 */
export class FakeQueuePort implements QueuePort {
  private enqueuedReminderJobs: EnqueueReminderData[] = [];
  private enqueuedSummaryJobs: EnqueueEntrySummaryData[] = [];

  async enqueueReminder(data: EnqueueReminderData): Promise<void> {
    this.enqueuedReminderJobs.push(data);
  }

  async enqueueEntrySummary(data: EnqueueEntrySummaryData): Promise<void> {
    this.enqueuedSummaryJobs.push(data);
  }

  // Test helpers for reminders
  getEnqueuedJobs(): EnqueueReminderData[] {
    return [...this.enqueuedReminderJobs];
  }

  getLastEnqueuedJob(): EnqueueReminderData | undefined {
    return this.enqueuedReminderJobs[this.enqueuedReminderJobs.length - 1];
  }

  // Test helpers for summaries
  getEnqueuedSummaryJobs(): EnqueueEntrySummaryData[] {
    return [...this.enqueuedSummaryJobs];
  }

  getLastEnqueuedSummaryJob(): EnqueueEntrySummaryData | undefined {
    return this.enqueuedSummaryJobs[this.enqueuedSummaryJobs.length - 1];
  }

  clear(): void {
    this.enqueuedReminderJobs = [];
    this.enqueuedSummaryJobs = [];
  }
}
