import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessReminderJob } from "../../application/use-cases/reminders/ProcessReminderJob";
import { PrismaReminderRepository } from "../persistence/PrismaReminderRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { PrismaEntryRepository } from "../persistence/PrismaEntryRepository";
import { N8NClient } from "../automation/N8NClient";
import { logger, withJobContext } from "../logging/logger";
import {
  initSentryForWorker,
  captureWorkerException,
} from "../logging/sentryCapture";
import { withSentrySpan } from "../logging/sentryTracing";

/**
 * Job data structure for reminder jobs.
 */
interface ReminderJobData {
  reminderId: string;
  originalScheduledAt: string;
}

const QUEUE_NAME = "reminders";

/**
 * Creates and starts the reminder worker.
 */
async function startWorker() {
  initSentryForWorker();
  logger.info({ queue: QUEUE_NAME }, "worker.starting");

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Create dependencies
  const reminderRepository = new PrismaReminderRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const entryRepository = new PrismaEntryRepository();
  const automationPort = new N8NClient();
  const processReminderJob = new ProcessReminderJob(
    reminderRepository,
    notificationRepository,
    automationPort,
    entryRepository,
  );

  // Create worker
  const worker = new Worker<ReminderJobData>(
    QUEUE_NAME,
    async (job: Job<ReminderJobData>) => {
      const log = withJobContext({
        jobId: job.id ?? "unknown",
        queue: QUEUE_NAME,
        action: "REMINDER",
      });
      const start = performance.now();

      log.info({ reminderId: job.data.reminderId }, "job.start");

      const result = await withSentrySpan(
        {
          name: "worker.reminder.execute",
          op: "queue.process",
          attributes: {
            "queue.name": QUEUE_NAME,
            "job.id": job.id ?? "unknown",
            "reminder.id": job.data.reminderId,
          },
        },
        () =>
          processReminderJob.execute({
            reminderId: job.data.reminderId,
            originalScheduledAt: job.data.originalScheduledAt,
          }),
      );

      const durationMs = Math.round(performance.now() - start);

      if (result.isErr()) {
        log.error({ err: result.error, durationMs }, "job.use_case_error");
        throw new Error(result.error.message);
      }

      const outcome = result.value;

      if (outcome.status === "failed") {
        log.warn({ reason: outcome.reason, durationMs }, "job.outcome_failed");
        throw new Error(`Reminder failed: ${outcome.reason}`);
      }

      log.info({ status: outcome.status, durationMs }, "job.success");
      return outcome;
    },
    {
      connection,
      concurrency: 5,
    },
  );

  // Event handlers
  worker.on("completed", (job) => {
    logger.debug({ jobId: job?.id, queue: QUEUE_NAME }, "job.completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, queue: QUEUE_NAME, err: error },
      "job.failed",
    );
    captureWorkerException(error, {
      queue: QUEUE_NAME,
      jobId: job?.id,
      action: "REMINDER",
    });
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ jobId, queue: QUEUE_NAME }, "job.stalled");
  });

  worker.on("error", (error) => {
    logger.error({ queue: QUEUE_NAME, err: error }, "worker.error");
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info({ queue: QUEUE_NAME }, "worker.shutting_down");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  logger.info({ queue: QUEUE_NAME }, "worker.ready");
}

// Start the worker
startWorker().catch((error) => {
  logger.fatal({ queue: QUEUE_NAME, err: error }, "worker.start_failed");
  process.exit(1);
});
