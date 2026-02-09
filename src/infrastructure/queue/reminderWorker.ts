import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ProcessReminderJob } from "../../application/use-cases/reminders/ProcessReminderJob";
import { PrismaReminderRepository } from "../persistence/PrismaReminderRepository";
import { PrismaNotificationRepository } from "../persistence/PrismaNotificationRepository";
import { N8NClient } from "../automation/N8NClient";

/**
 * Job data structure for reminder jobs.
 */
interface ReminderJobData {
  reminderId: string;
  originalScheduledAt: string;
}

/**
 * Creates and starts the reminder worker.
 */
async function startWorker() {
  console.log("Starting reminder worker...");

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Create dependencies
  const reminderRepository = new PrismaReminderRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const automationPort = new N8NClient();
  const processReminderJob = new ProcessReminderJob(
    reminderRepository,
    notificationRepository,
    automationPort
  );

  // Create worker
  const worker = new Worker<ReminderJobData>(
    "reminders",
    async (job: Job<ReminderJobData>) => {
      console.log(`Processing job ${job.id} for reminder ${job.data.reminderId}`);

      const result = await processReminderJob.execute({
        reminderId: job.data.reminderId,
        originalScheduledAt: job.data.originalScheduledAt,
      });

      if (result.isErr()) {
        console.error(`Job ${job.id} error:`, result.error);
        throw new Error(result.error.message);
      }

      const outcome = result.value;
      console.log(`Job ${job.id} result:`, outcome);

      if (outcome.status === "failed") {
        // Throw error to trigger retry
        throw new Error(`Reminder failed: ${outcome.reason}`);
      }

      return outcome;
    },
    {
      connection,
      concurrency: 5,
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
    console.log("Shutting down worker...");
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("Reminder worker started. Waiting for jobs...");
}

// Start the worker
startWorker().catch((error) => {
  console.error("Failed to start worker:", error);
  process.exit(1);
});
