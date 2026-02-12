import { MonthKey } from "@/domain/value-objects/MonthKey";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { ClockPort } from "../../ports/ClockPort";

export interface GetAiUsageInput {
  userId: string;
  action: string;
  month?: string; // YYYY-MM, default current
}

export interface GetAiUsageOutput {
  action: string;
  month: string;
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  maxActivePerUser: number;
  rateLimitPerMinute: number;
  maxInputChars: number;
}

export interface GetAiUsageConfig {
  monthlyQuotaRequests: number;
  monthlyQuotaTokens: number;
  maxActivePerUser: number;
  rateLimitPerMinute: number;
  maxInputChars: number;
}

/**
 * Use case: Get current AI usage and limits for the UI.
 */
export class GetAiUsage {
  constructor(
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort,
    private readonly config: GetAiUsageConfig
  ) {}

  async execute(input: GetAiUsageInput): Promise<GetAiUsageOutput> {
    const { userId, action, month } = input;
    const monthKey =
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ? month
        : MonthKey.fromDate(this.clock.now()).toString();

    const monthly = await this.aiUsageRepository.getMonthly(
      userId,
      action,
      monthKey
    );

    return {
      action,
      month: monthKey,
      requestsUsed: monthly?.requestsUsed ?? 0,
      requestsLimit: this.config.monthlyQuotaRequests,
      tokensUsed: monthly?.tokensUsed ?? 0,
      tokensLimit: this.config.monthlyQuotaTokens,
      maxActivePerUser: this.config.maxActivePerUser,
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      maxInputChars: this.config.maxInputChars,
    };
  }
}
