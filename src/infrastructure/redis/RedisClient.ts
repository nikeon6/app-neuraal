import IORedis from "ioredis";

let sharedConnection: IORedis | null = null;

/**
 * Returns a shared Redis connection for rate limiting and other non-queue use.
 * Uses REDIS_URL from env. Call closeRedisConnection() on app shutdown if needed.
 */
export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    const url =
      process.env.REDIS_URL ?? process.env.CACHE_REDIS_URI ?? "redis://localhost:6379";
    sharedConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}

/**
 * Closes the shared Redis connection (e.g. in tests or graceful shutdown).
 */
export async function closeRedisConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
