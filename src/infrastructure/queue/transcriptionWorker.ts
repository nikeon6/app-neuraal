import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessTranscriptionJob } from "../../application/use-cases/transcriptions/ProcessTranscriptionJob";
import { PrismaEntryRepository } from "../persistence/PrismaEntryRepository";
import { PrismaTranscriptionRequestRepository } from "../persistence/PrismaTranscriptionRequestRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { N8NClient } from "../automation/N8NClient";

/**
 * Job data structure for transcription jobs.
 */
interface TranscriptionJobData {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

/**
 * Creates and starts the transcription worker.
 */
async function startWorker() {
  console.log("Starting transcription worker...");

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Build callback URL from env
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const callbackUrl = `${appBaseUrl}/api/automations/entry-transcription/callback`;

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const transcriptionRequestRepository =
    new PrismaTranscriptionRequestRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const automationPort = new N8NClient();

  const processTranscriptionJob = new ProcessTranscriptionJob(
    entryRepository,
    transcriptionRequestRepository,
    notificationRepository,
    automationPort,
    callbackUrl
  );

  // Create worker
  const worker = new Worker<TranscriptionJobData>(
    "transcriptions",
    async (job: Job<TranscriptionJobData>) => {
      console.log(
        `Processing job ${job.id} for transcription request ${job.data.requestId}`
      );

      const result = await processTranscriptionJob.execute({
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
        throw new Error(`Transcription failed: ${outcome.reason}`);
      }

      return outcome;
    },
    {
      connection,
      concurrency: 3,
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
    console.log("Shutting down transcription worker...");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("Transcription worker started. Waiting for jobs...");
}

// Start the worker
startWorker().catch((error) => {
  console.error("Failed to start transcription worker:", error);
  process.exit(1);
});
