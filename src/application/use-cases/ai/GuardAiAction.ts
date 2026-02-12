import { Result, ok, err } from "@/domain/core/Result";
import { AiAction } from "@/domain/value-objects/AiAction";
import { MonthKey } from "@/domain/value-objects/MonthKey";
import { CharCount } from "@/domain/value-objects/CharCount";
import { QuotaLimit } from "@/domain/value-objects/QuotaLimit";
import type { SummaryRequestRepository } from "../../ports/SummaryRequestRepository";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { RateLimiterPort } from "../../ports/RateLimiterPort";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  concurrencyLimitError,
  rateLimitedError,
  quotaExceededError,
} from "../../core/UseCaseError";

/**
 * Config for SUMMARY guardrails (from env).
 */
export interface GuardAiActionConfig {
  maxActivePerUser: number;
  maxActivePerEntry: number;
  maxInputChars: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number; // 0 = disabled
  monthlyQuotaRequests: number;
  rateLimitPrefix: string;
}

export interface GuardAiActionInput {
  userId: string;
  action: string; // "SUMMARY"
  entryId?: string;
  inputChars?: number;
}

export interface GuardAiActionOutput {
  allowed: true;
  truncated?: boolean;
  maxChars?: number;
  /** Plain text to send (truncated if over limit). Only set when truncated. */
  truncatedPlainText?: string;
}

/**
 * Use case: Guard an AI action (rate limit, concurrency, input size, quota).
 * Order of checks: concurrency user -> concurrency entry -> max input (truncate) -> rate limit -> quota.
 */
export class GuardAiAction {
  constructor(
    private readonly summaryRequestRepository: SummaryRequestRepository,
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly config: GuardAiActionConfig
  ) {}

  async execute(
    input: GuardAiActionInput
  ): Promise<Result<GuardAiActionOutput, UseCaseError>> {
    const { userId, action, entryId, inputChars } = input;

    const actionResult = AiAction.create(action);
    if (actionResult.isErr()) {
      return err({ code: "VALIDATION_ERROR", message: actionResult.error });
    }
    const actionStr = actionResult.value.toString();

    // 1) Concurrency per user
    const activeUser = await this.summaryRequestRepository.countActiveByUserId(
      userId
    );
    if (activeUser >= this.config.maxActivePerUser) {
      return err(
        concurrencyLimitError(
          "Maximum concurrent summary requests reached. Wait for the current one to finish."
        )
      );
    }

    // 2) Concurrency per entry (if applicable)
    if (entryId) {
      const activeEntry =
        await this.summaryRequestRepository.findActiveByEntryId(entryId);
      if (activeEntry) {
        return err(
          concurrencyLimitError(
            "A summary request is already in progress for this entry."
          )
        );
      }
    }

    // 3) Max input: truncate and signal (recommended option)
    let truncated = false;
    let truncatedPlainText: string | undefined;
    const maxChars = this.config.maxInputChars;
    if (
      inputChars !== undefined &&
      CharCount.fromNumber(inputChars).exceedsMax(maxChars)
    ) {
      truncated = true;
      // Caller will pass the full text; we don't have it here. So we only signal.
      // truncatedPlainText will be set by the caller after truncation.
    }

    // 4) Rate limit (minute, then hour if configured)
    const prefix = this.config.rateLimitPrefix;
    const minuteKey = `${prefix}:${actionStr}:${userId}:min`;
    const minuteResult = await this.rateLimiter.hit(
      minuteKey,
      this.config.rateLimitPerMinute,
      60
    );
    if (!minuteResult.allowed) {
      return err(
        rateLimitedError("Too many requests. Try again later.", {
          remaining: minuteResult.remaining,
          resetAt: minuteResult.resetAt.toISOString(),
        })
      );
    }

    if (this.config.rateLimitPerHour > 0) {
      const hourKey = `${prefix}:${actionStr}:${userId}:hour`;
      const hourResult = await this.rateLimiter.hit(
        hourKey,
        this.config.rateLimitPerHour,
        3600
      );
      if (!hourResult.allowed) {
        return err(
          rateLimitedError("Hourly limit reached. Try again later.", {
            remaining: hourResult.remaining,
            resetAt: hourResult.resetAt.toISOString(),
          })
        );
      }
    }

    // 5) Monthly quota
    const now = this.clock.now();
    const monthKey = MonthKey.fromDate(now).toString();
    const monthly = await this.aiUsageRepository.getMonthly(
      userId,
      actionStr,
      monthKey
    );
    const requestsUsed = monthly?.requestsUsed ?? 0;
    const quotaLimit = QuotaLimit.fromNumber(this.config.monthlyQuotaRequests);
    if (quotaLimit.isExceeded(requestsUsed + 1)) {
      return err(
        quotaExceededError(
          "Monthly summary limit reached. Resets next month."
        )
      );
    }

    const output: GuardAiActionOutput = {
      allowed: true,
    };
    if (truncated) {
      output.truncated = true;
      output.maxChars = maxChars;
    }
    return ok(output);
  }
}
