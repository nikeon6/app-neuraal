import type { RateLimiterPort, RateLimitHitResult } from "@/application/ports/RateLimiterPort";
import type { Redis } from "ioredis";

/**
 * Fixed-window rate limiter using Redis INCR + EXPIRE.
 */
export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async hit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitHitResult> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      const ttl = await this.redis.ttl(key);
      const resetAt = new Date(Date.now() + (ttl > 0 ? ttl : windowSeconds) * 1000);
      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;

      return {
        allowed,
        remaining,
        resetAt,
      };
    } catch (err) {
      // Fail open: if Redis is down, allow the request (rate limit not enforced)
      console.warn("[RedisRateLimiter] Redis unavailable, allowing request:", err instanceof Error ? err.message : err);
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      };
    }
  }
}
