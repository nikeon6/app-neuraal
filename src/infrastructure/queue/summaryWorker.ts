import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessEntrySummaryJob } from "../../application/use-cases/summaries/ProcessEntrySummaryJob";
import { PrismaEntryRepository } from "../persistence/PrismaEntryRepository";
import { PrismaSummaryRequestRepository } from "../persistence/PrismaSummaryRequestRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { N8NClient } from "../automation/N8NClient";
import { logger, withJobContext } from "../logging/logger";
import {
  initSentryForWorker,
  captureWorkerException,
} from "../logging/sentryCapture";

/**
 * Job data structure for summary jobs.
 */
interface SummaryJobData {
  requestId: string;
  userId: string;
  entryId: string;
  plainTextForSummary?: string;
}

const QUEUE_NAME = "summaries";

/**
 * Creates and starts the summary worker.
 */
async function startWorker() {
  initSentryForWorker();
  logger.info({ queue: QUEUE_NAME }, "worker.starting");

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Build callback URL from env
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const callbackUrl = `${appBaseUrl}/api/automations/entry-summary/callback`;

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const summaryRequestRepository = new PrismaSummaryRequestRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const automationPort = new N8NClient();

  const processEntrySummaryJob = new ProcessEntrySummaryJob(
    entryRepository,
    summaryRequestRepository,
    notificationRepository,
    automationPort,
    callbackUrl,
  );

  // Create worker
  const worker = new Worker<SummaryJobData>(
    QUEUE_NAME,
    async (job: Job<SummaryJobData>) => {
      const log = withJobContext({
        jobId: job.id ?? "unknown",
        queue: QUEUE_NAME,
        userId: job.data.userId,
        action: "SUMMARY",
        requestId: job.data.requestId,
      });
      const start = performance.now();

      log.info(
        { entryId: job.data.entryId, requestId: job.data.requestId },
        "job.start",
      );

      const result = await processEntrySummaryJob.execute({
        requestId: job.data.requestId,
        userId: job.data.userId,
        entryId: job.data.entryId,
        plainTextForSummary: job.data.plainTextForSummary,
      });

      const durationMs = Math.round(performance.now() - start);

      if (result.isErr()) {
        log.error({ err: result.error, durationMs }, "job.use_case_error");
        throw new Error(result.error.message);
      }

      const outcome = result.value;

      if (outcome.status === "failed") {
        log.warn({ reason: outcome.reason, durationMs }, "job.outcome_failed");
        throw new Error(`Summary failed: ${outcome.reason}`);
      }

      log.info({ status: outcome.status, durationMs }, "job.success");
      return outcome;
    },
    {
      connection,
      concurrency: 3,
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
      action: "SUMMARY",
      userId: job?.data?.userId,
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
