import { beforeEach, describe, expect, it } from "vitest";
import {
  GuardAiAction,
  type ConcurrencyChecker,
  type GuardAiActionConfig,
} from "./GuardAiAction";
import { InMemoryAiUsageRepository } from "../../test/InMemoryAiUsageRepository";
import { FakeClock } from "../../test/FakeClock";
import { MonthKey } from "@/domain/value-objects/MonthKey";
import type {
  RateLimitHitResult,
  RateLimiterPort,
} from "../../ports/RateLimiterPort";

class StubRateLimiter implements RateLimiterPort {
  public readonly calls: Array<{
    key: string;
    limit: number;
    windowSeconds: number;
  }> = [];
  private readonly queue: RateLimitHitResult[] = [];

  enqueue(result: RateLimitHitResult): void {
    this.queue.push(result);
  }

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitHitResult> {
    this.calls.push({ key, limit, windowSeconds });
    return (
      this.queue.shift() ?? {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        resetAt: new Date("2026-02-11T10:01:00.000Z"),
      }
    );
  }
}

describe("GuardAiAction", () => {
  let aiUsageRepository: InMemoryAiUsageRepository;
  let rateLimiter: StubRateLimiter;
  let clock: FakeClock;
  let config: GuardAiActionConfig;

  beforeEach(() => {
    aiUsageRepository = new InMemoryAiUsageRepository();
    rateLimiter = new StubRateLimiter();
    clock = new FakeClock(new Date("2026-02-11T10:00:00.000Z"));
    config = {
      maxActivePerUser: 2,
      maxActivePerEntry: 1,
      maxInputChars: 100,
      maxInputBytes: 1024,
      rateLimitPerMinute: 5,
      rateLimitPerHour: 10,
      monthlyQuotaRequests: 10,
      rateLimitPrefix: "ai:test",
    };
  });

  function createUseCase(
    concurrencyChecker: ConcurrencyChecker,
    customConfig?: Partial<GuardAiActionConfig>,
  ) {
    return new GuardAiAction(
      concurrencyChecker,
      aiUsageRepository,
      rateLimiter,
      clock,
      {
        ...config,
        ...customConfig,
      },
    );
  }

  it("returns validation error for unknown action", async () => {
    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "UNKNOWN_ACTION",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns CONCURRENCY_LIMIT when user has too many active requests", async () => {
    const useCase = createUseCase({
      countActiveByUserId: async () => 2,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONCURRENCY_LIMIT");
      expect(result.error.details).toEqual({ scope: "USER" });
    }
  });

  it("returns CONCURRENCY_LIMIT when entry already has active request", async () => {
    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
      findActiveByEntryId: async () => ({ id: "active-1" }),
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
      entryId: "entry-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONCURRENCY_LIMIT");
      expect(result.error.details).toEqual({
        scope: "ENTRY",
        entryId: "entry-1",
      });
    }
  });

  it("returns INPUT_TOO_LARGE when input bytes exceed max", async () => {
    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
      findActiveByEntryId: async () => null,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
      entryId: "entry-1",
      inputBytes: 2048,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INPUT_TOO_LARGE");
    }
  });

  it("returns RATE_LIMITED when minute window is exhausted", async () => {
    rateLimiter.enqueue({
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-02-11T10:01:00.000Z"),
    });

    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.details).toEqual({
        remaining: 0,
        resetAt: "2026-02-11T10:01:00.000Z",
      });
    }
    expect(rateLimiter.calls).toHaveLength(1);
    expect(rateLimiter.calls[0]?.key).toContain(":min");
  });

  it("returns RATE_LIMITED when hour window is exhausted", async () => {
    rateLimiter.enqueue({
      allowed: true,
      remaining: 1,
      resetAt: new Date("2026-02-11T10:01:00.000Z"),
    });
    rateLimiter.enqueue({
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-02-11T11:00:00.000Z"),
    });

    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.details).toEqual({
        remaining: 0,
        resetAt: "2026-02-11T11:00:00.000Z",
      });
    }
    expect(rateLimiter.calls).toHaveLength(2);
    expect(rateLimiter.calls[1]?.key).toContain(":hour");
  });

  it("returns QUOTA_EXCEEDED when monthly requests are consumed", async () => {
    const monthKey = MonthKey.fromDate(clock.now()).toString();
    await aiUsageRepository.incrementRequests(
      "user-1",
      "SUMMARY",
      monthKey,
      10,
    );
    const useCase = createUseCase({
      countActiveByUserId: async () => 0,
    });

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("returns allowed=true with truncation metadata when chars exceed max", async () => {
    const useCase = createUseCase(
      {
        countActiveByUserId: async () => 0,
        findActiveByEntryId: async () => null,
      },
      {
        rateLimitPerHour: 0,
      },
    );

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
      entryId: "entry-1",
      inputChars: 150,
      inputBytes: 200,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.allowed).toBe(true);
      expect(result.value.truncated).toBe(true);
      expect(result.value.maxChars).toBe(100);
    }
    expect(rateLimiter.calls).toHaveLength(1);
  });

  it("returns allowed=true without truncation when input is within limits", async () => {
    const useCase = createUseCase(
      {
        countActiveByUserId: async () => 0,
        findActiveByEntryId: async () => null,
      },
      {
        maxInputChars: 0,
        maxInputBytes: 0,
      },
    );

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
      entryId: "entry-1",
      inputChars: 9999,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.allowed).toBe(true);
      expect(result.value.truncated).toBeUndefined();
      expect(result.value.maxChars).toBeUndefined();
    }
  });
});
