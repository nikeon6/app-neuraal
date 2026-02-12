import { Result, ok } from "@/domain/core/Result";
import { AiAction } from "@/domain/value-objects/AiAction";
import { MonthKey } from "@/domain/value-objects/MonthKey";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";

export interface ConsumeAiRequestInput {
  userId: string;
  action: string;
}

/**
 * Use case: Consume one request from the monthly quota (call when request is created / enqueued).
 */
export class ConsumeAiRequest {
  constructor(
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort
  ) {}

  async execute(
    input: ConsumeAiRequestInput
  ): Promise<Result<void, UseCaseError>> {
    const { userId, action } = input;

    const actionResult = AiAction.create(action);
    if (actionResult.isErr()) {
      return ok(undefined); // no-op for unknown action
    }

    const monthKey = MonthKey.fromDate(this.clock.now()).toString();
    await this.aiUsageRepository.incrementRequests(
      userId,
      actionResult.value.toString(),
      monthKey,
      1
    );
    return ok(undefined);
  }
}
