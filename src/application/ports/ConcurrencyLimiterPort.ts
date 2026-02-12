/**
 * Port for concurrency limiting (e.g. Redis-based).
 * Used for actions that don't have a dedicated request table (like OCR).
 */
export interface ConcurrencyLimiterPort {
  /**
   * Try to acquire a concurrency slot.
   * @param key - Unique key (e.g. "ocr:user:userId")
   * @param max - Max concurrent slots
   * @param ttlSeconds - Auto-release TTL (safety net)
   * @returns Whether the slot was acquired and current count
   */
  acquire(key: string, max: number, ttlSeconds: number): Promise<{ acquired: boolean; current: number }>;

  /**
   * Release a concurrency slot (best-effort).
   */
  release(key: string): Promise<void>;
}
