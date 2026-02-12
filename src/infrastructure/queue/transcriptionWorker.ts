import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessEntryTranscriptJob } from "../../application/use-cases/transcripts/ProcessEntryTranscriptJob";
import { PrismaEntryRepository } from "../persistence/PrismaEntryRepository";
import { PrismaTranscriptRequestRepository } from "../persistence/PrismaTranscriptRequestRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { N8NClient } from "../automation/N8NClient";

/**
 * Job data structure for transcript jobs.
 */
interface TranscriptJobData {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

/**
 * Creates and starts the transcript worker.
 */
async function startWorker() {
  console.log("Starting transcript worker...");

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const callbackUrl = `${appBaseUrl}/api/automations/entry-transcript/callback`;

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const transcriptRequestRepository = new PrismaTranscriptRequestRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const automationPort = new N8NClient();

  const processJob = new ProcessEntryTranscriptJob(
    entryRepository,
    transcriptRequestRepository,
    notificationRepository,
    automationPort,
    callbackUrl
  );

  // Create worker
  const worker = new Worker<TranscriptJobData>(
    "transcriptions",
    async (job: Job<TranscriptJobData>) => {
      console.log(`Processing job ${job.id} for transcript request ${job.data.requestId}`);

      const result = await processJob.execute({
        requestId: job.data.requestId,
        userId: job.data.userId,
        entryId: job.data.entryId,
        youtubeUrl: job.data.youtubeUrl,
      });

      if (result.isErr()) {
        console.error(`Job ${job.id} error:`, result.error);
        throw new Error(result.error.message);
      }

      const outcome = result.value;
      console.log(`Job ${job.id} result:`, outcome);

      if (outcome.status === "failed") {
        throw new Error(`Transcript failed: ${outcome.reason}`);
      }

      return outcome;
    },
    { connection, concurrency: 3 }
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
    console.log("Shutting down transcript worker...");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("Transcript worker started. Waiting for jobs...");
}

// Start the worker
startWorker().catch((error) => {
  console.error("Failed to start transcript worker:", error);
  process.exit(1);
});
