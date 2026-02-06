import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  QueuePort,
  EnqueueReminderData,
  EnqueueEntrySummaryData,
} from "../../application/ports/QueuePort";

/**
 * BullMQ implementation of QueuePort.
 * Manages multiple queues: reminders and summaries.
 */
export class BullMQAdapter implements QueuePort {
  private remindersQueue: Queue;
  private summariesQueue: Queue;
  private connection: IORedis;

  constructor(redisUrl?: string) {
    this.connection = new IORedis(
      redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379",
      {
        maxRetriesPerRequest: null,
      }
    );

    this.remindersQueue = new Queue("reminders", { connection: this.connection });
    this.summariesQueue = new Queue("summaries", { connection: this.connection });
  }

  async enqueueReminder(data: EnqueueReminderData): Promise<void> {
    const scheduledAt = new Date(data.scheduledAt);
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    await this.remindersQueue.add(
      "send-reminder",
      {
        reminderId: data.reminderId,
        originalScheduledAt: data.scheduledAt,
      },
      {
        jobId: `reminder-${data.reminderId}-${data.scheduledAt}`,
        delay,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000, // Start with 5 seconds
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  async enqueueEntrySummary(data: EnqueueEntrySummaryData): Promise<void> {
    await this.summariesQueue.add(
      "generate-summary",
      {
        requestId: data.requestId,
        userId: data.userId,
        entryId: data.entryId,
      },
      {
        jobId: `summary-${data.requestId}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10000, // Start with 10 seconds
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  /**
   * Closes all queue connections.
   */
  async close(): Promise<void> {
    await this.remindersQueue.close();
    await this.summariesQueue.close();
    await this.connection.quit();
  }
}
