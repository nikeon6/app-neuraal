import type { ConcurrencyLimiterPort } from "@/application/ports/ConcurrencyLimiterPort";
import type { Redis } from "ioredis";

/**
 * Redis-based concurrency limiter using INCR/DECR with TTL safety net.
 */
export class RedisConcurrencyLimiter implements ConcurrencyLimiterPort {
  constructor(private readonly redis: Redis) {}

  async acquire(
    key: string,
    max: number,
    ttlSeconds: number,
  ): Promise<{ acquired: boolean; current: number }> {
    try {
      const current = await this.redis.incr(key);
      // Set TTL on first increment (safety net: auto-release if release fails)
      if (current === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      if (current > max) {
        // Over limit — roll back
        await this.redis.decr(key);
        return { acquired: false, current: current - 1 };
      }
      return { acquired: true, current };
    } catch (err) {
      // Fail open
      console.warn(
        "[RedisConcurrencyLimiter] Redis unavailable, allowing:",
        err instanceof Error ? err.message : err,
      );
      return { acquired: true, current: 0 };
    }
  }

  async release(key: string): Promise<void> {
    try {
      const val = await this.redis.decr(key);
      if (val <= 0) {
        await this.redis.del(key);
      }
    } catch {
      // Best-effort
    }
  }
}
