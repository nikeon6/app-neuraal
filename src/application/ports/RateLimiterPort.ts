/**
 * Result of a rate limit check (fixed window).
 */
export interface RateLimitHitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Port for rate limiting (e.g. Redis fixed window).
 */
export interface RateLimiterPort {
  /**
   * Records a hit and returns whether the request is allowed.
   * @param key - Unique key (e.g. "ai:rl:SUMMARY:userId")
   * @param limit - Max hits per window
   * @param windowSeconds - Window duration in seconds
   */
  hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitHitResult>;
}
