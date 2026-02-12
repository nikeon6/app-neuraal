/**
 * Rate limit configuration value (limit + window in seconds).
 * Used to pass config to the rate limiter port.
 */
export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export function createRateLimitConfig(
  limit: number,
  windowSeconds: number
): RateLimitConfig {
  return {
    limit: Math.max(0, Math.floor(limit)),
    windowSeconds: Math.max(1, Math.floor(windowSeconds)),
  };
}
