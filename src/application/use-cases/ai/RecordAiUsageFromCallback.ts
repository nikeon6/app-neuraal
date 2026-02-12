import { Result, ok, err } from "@/domain/core/Result";
import { AiAction } from "@/domain/value-objects/AiAction";
import { MonthKey } from "@/domain/value-objects/MonthKey";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

export interface AiUsageFromCallback {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
  costCents?: number;
  provider?: string;
}

export interface RecordAiUsageFromCallbackInput {
  userId: string;
  action: string;
  requestId: string;
  usage?: AiUsageFromCallback;
}

/**
 * Use case: Record AI usage from n8n callback (tokens + ledger).
 * If usage.totalTokens exists, increment monthly tokens and add ledger entry.
 * Always add a ledger entry (minimal meta if no usage).
 */
export class RecordAiUsageFromCallback {
  constructor(
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort
  ) {}

  async execute(
    input: RecordAiUsageFromCallbackInput
  ): Promise<Result<void, UseCaseError>> {
    const { userId, action, requestId, usage } = input;

    const actionResult = AiAction.create(action);
    if (actionResult.isErr()) {
      return err(validationError(`Unknown action: ${action}`));
    }
    const actionStr = actionResult.value.toString();
    const now = this.clock.now();
    const monthKey = MonthKey.fromDate(now).toString();

    if (usage?.totalTokens && usage.totalTokens > 0) {
      await this.aiUsageRepository.incrementTokens(
        userId,
        actionStr,
        monthKey,
        usage.totalTokens
      );
    }

    await this.aiUsageRepository.addLedgerEntry({
      userId,
      action: actionStr,
      requestId,
      model: usage?.model,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      costCents: usage?.costCents,
      metaJson: usage
        ? {
            provider: usage.provider,
            model: usage.model,
            totalTokens: usage.totalTokens,
          }
        : { source: "callback", hasUsage: false },
    });

    return ok(undefined);
  }
}
