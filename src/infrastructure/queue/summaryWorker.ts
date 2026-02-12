import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessEntrySummaryJob } from "../../application/use-cases/summaries/ProcessEntrySummaryJob";
import { PrismaEntryRepository } from "../persistence/PrismaEntryRepository";
import { PrismaSummaryRequestRepository } from "../persistence/PrismaSummaryRequestRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { N8NClient } from "../automation/N8NClient";

/**
 * Job data structure for summary jobs.
 */
interface SummaryJobData {
  requestId: string;
  userId: string;
  entryId: string;
  plainTextForSummary?: string;
}

/**
 * Creates and starts the summary worker.
 */
async function startWorker() {
  console.log("Starting summary worker...");

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
    callbackUrl
  );

  // Create worker
  const worker = new Worker<SummaryJobData>(
    "summaries",
    async (job: Job<SummaryJobData>) => {
      console.log(
        `Processing job ${job.id} for summary request ${job.data.requestId}`
      );

      const result = await processEntrySummaryJob.execute({
        requestId: job.data.requestId,
        userId: job.data.userId,
        entryId: job.data.entryId,
        plainTextForSummary: job.data.plainTextForSummary,
      });

      if (result.isErr()) {
        console.error(`Job ${job.id} error:`, result.error);
        throw new Error(result.error.message);
      }

      const outcome = result.value;
      console.log(`Job ${job.id} result:`, outcome);

      if (outcome.status === "failed") {
        // Throw error to trigger retry
        throw new Error(`Summary failed: ${outcome.reason}`);
      }

      return outcome;
    },
    {
      connection,
      concurrency: 3, // Lower concurrency for n8n calls
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    console.log(`Job ${job?.id} completed:`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down summary worker...");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("Summary worker started. Waiting for jobs...");
}

// Start the worker
startWorker().catch((error) => {
  console.error("Failed to start summary worker:", error);
  process.exit(1);
});
