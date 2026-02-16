/**
 * In-memory rate limiter for login attempts.
 *
 * Tracks failed login attempts per key (IP or email) and blocks
 * further attempts after the threshold is reached.
 *
 * Config:
 * - maxAttempts: number of failed attempts before lockout (default: 5)
 * - windowMs: time window to track attempts (default: 15 minutes)
 * - lockoutMs: lockout duration after max attempts (default: 5 minutes)
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

export interface RateLimiterConfig {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  remainingAttempts?: number;
}

class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimiterConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
    this.lockoutMs = config.lockoutMs ?? DEFAULT_LOCKOUT_MS;

    // Periodic cleanup of expired entries (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Allow GC to collect the interval if the module is unloaded
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a login attempt is allowed for the given key.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const record = this.attempts.get(key);

    // No record — allowed
    if (!record) {
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        allowed: false,
        retryAfterMs: record.lockedUntil - now,
      };
    }

    // Lockout expired — reset
    if (record.lockedUntil && now >= record.lockedUntil) {
      this.attempts.delete(key);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Window expired — reset
    if (now - record.firstAttemptAt > this.windowMs) {
      this.attempts.delete(key);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // Within window, check count
    const remaining = this.maxAttempts - record.count;
    return {
      allowed: remaining > 0,
      remainingAttempts: Math.max(0, remaining),
      retryAfterMs: remaining <= 0 ? this.lockoutMs : undefined,
    };
  }

  /**
   * Record a failed login attempt. Returns the updated rate limit result.
   */
  recordFailure(key: string): RateLimitResult {
    const now = Date.now();
    let record = this.attempts.get(key);

    // Reset if window expired or lockout expired
    if (record) {
      if (
        (record.lockedUntil && now >= record.lockedUntil) ||
        now - record.firstAttemptAt > this.windowMs
      ) {
        record = undefined;
        this.attempts.delete(key);
      }
    }

    if (!record) {
      record = { count: 1, firstAttemptAt: now, lockedUntil: null };
      this.attempts.set(key, record);
    } else {
      record.count++;
    }

    // Check if threshold reached
    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
      return {
        allowed: false,
        retryAfterMs: this.lockoutMs,
        remainingAttempts: 0,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - record.count,
    };
  }

  /**
   * Record a successful login — resets the counter for the key.
   */
  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts) {
      const expired =
        (record.lockedUntil && now >= record.lockedUntil) ||
        now - record.firstAttemptAt > this.windowMs;
      if (expired) {
        this.attempts.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance (survives hot-reloads in dev via globalThis)
// ---------------------------------------------------------------------------

const globalForRateLimiter = globalThis as unknown as {
  loginRateLimiter?: LoginRateLimiter;
};

export const loginRateLimiter =
  globalForRateLimiter.loginRateLimiter ??
  new LoginRateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 5 * 60 * 1000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRateLimiter.loginRateLimiter = loginRateLimiter;
}
