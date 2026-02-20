import { Result, ok, err } from "@/domain/core/Result";
import { AiAction } from "@/domain/value-objects/AiAction";
import { MonthKey } from "@/domain/value-objects/MonthKey";
import { CharCount } from "@/domain/value-objects/CharCount";
import { QuotaLimit } from "@/domain/value-objects/QuotaLimit";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { RateLimiterPort } from "../../ports/RateLimiterPort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  concurrencyLimitError,
  rateLimitedError,
  quotaExceededError,
  inputTooLargeError,
} from "../../core/UseCaseError";

/**
 * Per-action config for guardrails (from env).
 */
export interface GuardAiActionConfig {
  maxActivePerUser: number;
  maxActivePerEntry: number; // 0 = N/A
  maxInputChars: number; // 0 = N/A
  maxInputBytes: number; // 0 = N/A
  rateLimitPerMinute: number;
  rateLimitPerHour: number; // 0 = disabled
  monthlyQuotaRequests: number;
  rateLimitPrefix: string;
}

export interface GuardAiActionInput {
  userId: string;
  action: string;
  entryId?: string;
  inputChars?: number;
  inputBytes?: number;
}

/**
 * Concurrency checker abstraction — caller provides a function that returns
 * the current active count for the user (and optionally per entry).
 */
export interface ConcurrencyChecker {
  countActiveByUserId(userId: string): Promise<number>;
  findActiveByEntryId?(entryId: string): Promise<{ id: string } | null>;
}

export interface GuardAiActionOutput {
  allowed: true;
  truncated?: boolean;
  maxChars?: number;
  maxBytes?: number;
}

/**
 * Use case: Guard an AI action (rate limit, concurrency, input size, quota).
 * Generalized for all AI action types.
 *
 * Check order: concurrency user -> concurrency entry -> input size -> rate limit -> quota.
 */
export class GuardAiAction {
  constructor(
    private readonly concurrencyChecker: ConcurrencyChecker,
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly config: GuardAiActionConfig,
  ) {}

  async execute(
    input: GuardAiActionInput,
  ): Promise<Result<GuardAiActionOutput, UseCaseError>> {
    const { userId, action, entryId, inputChars, inputBytes } = input;

    const actionResult = AiAction.create(action);
    if (actionResult.isErr()) {
      return err({ code: "VALIDATION_ERROR", message: actionResult.error });
    }
    const actionStr = actionResult.value.toString();

    // 1) Concurrency checks
    const concurrencyError = await this.checkConcurrency(
      userId,
      entryId,
      actionStr,
    );
    if (concurrencyError) return err(concurrencyError);

    // 2) Input size check
    const truncated = this.checkInputTruncation(inputChars);
    const bytesError = this.checkInputBytes(inputBytes);
    if (bytesError) return err(bytesError);

    // 3) Rate limit
    const rlError = await this.checkRateLimit(userId, actionStr);
    if (rlError) return err(rlError);

    // 4) Monthly quota
    const quotaError = await this.checkMonthlyQuota(userId, actionStr);
    if (quotaError) return err(quotaError);

    const output: GuardAiActionOutput = { allowed: true };
    if (truncated) {
      output.truncated = true;
      output.maxChars = this.config.maxInputChars;
    }
    return ok(output);
  }

  private async checkConcurrency(
    userId: string,
    entryId: string | undefined,
    actionStr: string,
  ): Promise<UseCaseError | null> {
    const activeUser =
      await this.concurrencyChecker.countActiveByUserId(userId);
    if (activeUser >= this.config.maxActivePerUser) {
      return concurrencyLimitError(
        `Maximum concurrent ${actionStr} requests reached. Wait for the current one to finish.`,
        { scope: "USER" },
      );
    }

    if (
      entryId &&
      this.config.maxActivePerEntry > 0 &&
      this.concurrencyChecker.findActiveByEntryId
    ) {
      const activeEntry =
        await this.concurrencyChecker.findActiveByEntryId(entryId);
      if (activeEntry) {
        return concurrencyLimitError(
          `A ${actionStr} request is already in progress for this entry.`,
          { scope: "ENTRY", entryId },
        );
      }
    }

    return null;
  }

  private checkInputTruncation(inputChars: number | undefined): boolean {
    const maxChars = this.config.maxInputChars;
    return (
      maxChars > 0 &&
      inputChars !== undefined &&
      CharCount.fromNumber(inputChars).exceedsMax(maxChars)
    );
  }

  private checkInputBytes(inputBytes: number | undefined): UseCaseError | null {
    const maxBytes = this.config.maxInputBytes;
    if (maxBytes > 0 && inputBytes !== undefined && inputBytes > maxBytes) {
      return inputTooLargeError(
        `Input size ${inputBytes} bytes exceeds maximum of ${maxBytes} bytes.`,
      );
    }
    return null;
  }

  private async checkRateLimit(
    userId: string,
    actionStr: string,
  ): Promise<UseCaseError | null> {
    const prefix = this.config.rateLimitPrefix;

    const minuteResult = await this.rateLimiter.hit(
      `${prefix}:${actionStr}:${userId}:min`,
      this.config.rateLimitPerMinute,
      60,
    );
    if (!minuteResult.allowed) {
      return rateLimitedError("Too many requests. Try again later.", {
        remaining: minuteResult.remaining,
        resetAt: minuteResult.resetAt.toISOString(),
      });
    }

    if (this.config.rateLimitPerHour > 0) {
      const hourResult = await this.rateLimiter.hit(
        `${prefix}:${actionStr}:${userId}:hour`,
        this.config.rateLimitPerHour,
        3600,
      );
      if (!hourResult.allowed) {
        return rateLimitedError("Hourly limit reached. Try again later.", {
          remaining: hourResult.remaining,
          resetAt: hourResult.resetAt.toISOString(),
        });
      }
    }

    return null;
  }

  private async checkMonthlyQuota(
    userId: string,
    actionStr: string,
  ): Promise<UseCaseError | null> {
    const now = this.clock.now();
    const monthKey = MonthKey.fromDate(now).toString();
    const monthly = await this.aiUsageRepository.getMonthly(
      userId,
      actionStr,
      monthKey,
    );
    const requestsUsed = monthly?.requestsUsed ?? 0;
    const quotaLimit = QuotaLimit.fromNumber(this.config.monthlyQuotaRequests);
    if (quotaLimit.isExceeded(requestsUsed + 1)) {
      return quotaExceededError(
        `Monthly ${actionStr} limit reached. Resets next month.`,
      );
    }
    return null;
  }
}
