import { MonthKey } from "@/domain/value-objects/MonthKey";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { ClockPort } from "../../ports/ClockPort";

export interface GetAiUsageInput {
  userId: string;
  action?: string; // specific action, or undefined for overview
  month?: string; // YYYY-MM, default current
}

export interface AiUsageItem {
  action: string;
  month: string;
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  maxActivePerUser: number;
  rateLimitPerMinute: number;
  maxInputChars: number;
  maxInputBytes: number;
}

export interface GetAiUsageOverviewOutput {
  month: string;
  items: AiUsageItem[];
}

export interface ActionConfigForUsage {
  action: string;
  monthlyQuotaRequests: number;
  monthlyQuotaTokens: number;
  maxActivePerUser: number;
  rateLimitPerMinute: number;
  maxInputChars: number;
  maxInputBytes: number;
}

/**
 * Use case: Get current AI usage and limits for the UI.
 * If action is specified, returns a single item. Otherwise returns overview of all actions.
 */
export class GetAiUsage {
  constructor(
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort,
    private readonly configs: ActionConfigForUsage[]
  ) {}

  async execute(input: GetAiUsageInput): Promise<GetAiUsageOverviewOutput> {
    const { userId, action, month } = input;
    const monthKey =
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ? month
        : MonthKey.fromDate(this.clock.now()).toString();

    const targetConfigs = action
      ? this.configs.filter((c) => c.action === action)
      : this.configs;

    const items: AiUsageItem[] = [];
    for (const cfg of targetConfigs) {
      const monthly = await this.aiUsageRepository.getMonthly(
        userId,
        cfg.action,
        monthKey
      );
      items.push({
        action: cfg.action,
        month: monthKey,
        requestsUsed: monthly?.requestsUsed ?? 0,
        requestsLimit: cfg.monthlyQuotaRequests,
        tokensUsed: monthly?.tokensUsed ?? 0,
        tokensLimit: cfg.monthlyQuotaTokens,
        maxActivePerUser: cfg.maxActivePerUser,
        rateLimitPerMinute: cfg.rateLimitPerMinute,
        maxInputChars: cfg.maxInputChars,
        maxInputBytes: cfg.maxInputBytes,
      });
    }

    return { month: monthKey, items };
  }
}
