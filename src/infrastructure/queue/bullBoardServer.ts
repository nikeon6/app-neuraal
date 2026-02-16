import "dotenv/config";
import express from "express";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { logger } from "../logging/logger";

const PORT = parseInt(process.env.BULLBOARD_PORT ?? "3001", 10);
const BULLBOARD_USER = process.env.BULLBOARD_USER ?? "admin";
const BULLBOARD_PASSWORD = process.env.BULLBOARD_PASSWORD ?? "";

const QUEUE_NAMES = ["reminders", "summaries", "transcriptions"];

async function start() {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  // Create queue instances (read-only, for monitoring)
  const queues = QUEUE_NAMES.map((name) => new Queue(name, { connection }));

  // Setup Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/");

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  const app = express();

  // Basic auth middleware
  if (BULLBOARD_PASSWORD) {
    app.use((req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
        res.status(401).send("Authentication required");
        return;
      }

      const credentials = Buffer.from(auth.slice(6), "base64").toString();
      const [user, pass] = credentials.split(":");

      if (user !== BULLBOARD_USER || pass !== BULLBOARD_PASSWORD) {
        res.status(401).send("Invalid credentials");
        return;
      }

      next();
    });
  }

  app.use("/", serverAdapter.getRouter());

  app.listen(PORT, () => {
    logger.info({ port: PORT, queues: QUEUE_NAMES }, "Bull Board started");
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Bull Board shutting down");
    await Promise.all(queues.map((q) => q.close()));
    connection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  logger.fatal({ err }, "Bull Board failed to start");
  process.exit(1);
});
