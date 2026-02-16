import { Result, ok, err } from "../../../domain/core/Result";
import { Notification } from "../../../domain/entities/Notification";
import {
  SummaryText,
  SummaryFormat,
} from "../../../domain/value-objects/SummaryText";
import { EntryRepository } from "../../ports/EntryRepository";
import { SummaryRequestRepository } from "../../ports/SummaryRequestRepository";
import { NotificationRepository } from "../../ports/NotificationRepository";
import type { RecordAiUsageFromCallback } from "../ai/RecordAiUsageFromCallback";
import {
  UseCaseError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../core/UseCaseError";
import crypto from "crypto";

/**
 * Optional usage from n8n (if LLM node exposes it).
 */
export interface EntrySummaryCallbackUsage {
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costCents?: number;
}

/**
 * Callback payload from n8n.
 */
export interface EntrySummaryCallbackPayload {
  requestId: string;
  userId: string;
  entryId: string;
  summary: string;
  format: SummaryFormat;
  usage?: EntrySummaryCallbackUsage;
}

/**
 * Input for HandleEntrySummaryCallback use case.
 */
export interface HandleEntrySummaryCallbackInput {
  rawBody: string;
  timestamp: string;
  signature: string;
  payload: EntrySummaryCallbackPayload;
}

/**
 * Output for HandleEntrySummaryCallback use case.
 */
export interface HandleEntrySummaryCallbackOutput {
  success: boolean;
  alreadyProcessed?: boolean;
}

/**
 * Use case: Handle callback from n8n with entry summary.
 *
 * Called by: POST /api/automations/entry-summary/callback
 *
 * Logic:
 * 1. Verify HMAC signature (X-Timestamp + X-Signature)
 * 2. Validate timestamp is not expired (< 5 minutes)
 * 3. Load summary request - return NOT_FOUND if not exists
 * 4. Check idempotency - if request is already done, return success
 * 5. Validate userId matches request
 * 6. Validate summary format
 * 7. Update entry with summary
 * 8. Mark request as done
 * 9. Create SUMMARY_DONE notification
 */
export class HandleEntrySummaryCallback {
  private static readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly summaryRequestRepository: SummaryRequestRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly webhookSecret: string,
    private readonly recordAiUsage?: RecordAiUsageFromCallback,
    private readonly generateId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(
    input: HandleEntrySummaryCallbackInput,
  ): Promise<Result<HandleEntrySummaryCallbackOutput, UseCaseError>> {
    const { rawBody, timestamp, signature, payload } = input;

    // 1 & 2. Verify HMAC signature and timestamp
    const signatureResult = this.verifySignature(rawBody, timestamp, signature);
    if (signatureResult.isErr()) {
      return err(signatureResult.error);
    }

    // 3. Load summary request
    const request = await this.summaryRequestRepository.findById(
      payload.requestId,
    );
    if (!request) {
      return err(notFoundError("Summary request not found"));
    }

    // 4. Idempotency check
    if (request.status.isDone()) {
      return ok({ success: true, alreadyProcessed: true });
    }

    // 5. Validate userId matches
    if (request.userId !== payload.userId) {
      return err(unauthorizedError("User ID mismatch in callback"));
    }

    // 5b. Validate entryId matches — use the stored request as source of truth
    if (request.entryId !== payload.entryId) {
      return err(
        validationError(
          "Entry ID mismatch: payload does not match original request",
        ),
      );
    }

    // 6. Validate summary
    const summaryResult = SummaryText.create(payload.summary, payload.format);
    if (summaryResult.isErr()) {
      return err(validationError(summaryResult.error));
    }

    // Use request.entryId (DB source of truth) instead of payload.entryId
    const { entryId } = request;

    // 7. Update entry with summary
    await this.entryRepository.updateSummary(
      entryId,
      summaryResult.value.toString(),
      summaryResult.value.getFormat(),
    );

    // 8. Mark request as done
    const doneRequest = request.markDone();
    await this.summaryRequestRepository.update(doneRequest);

    // 9. Create SUMMARY_DONE notification
    const entry = await this.entryRepository.findById(entryId);
    const entryTitle = entry?.title.toString() ?? "Entry";

    const notificationResult = Notification.create({
      id: this.generateId(),
      userId: request.userId,
      type: "SUMMARY_DONE",
      title: "Summary Complete",
      message: `Summary generated for "${entryTitle}"`,
      status: "unread",
      payload: {
        requestId: payload.requestId,
        entryId,
      },
      createdAt: new Date(),
    });

    if (notificationResult.isOk()) {
      await this.notificationRepository.create(notificationResult.value);
    }

    // Record AI usage from callback (tokens + ledger) if handler injected
    if (this.recordAiUsage) {
      await this.recordAiUsage.execute({
        userId: request.userId,
        action: "SUMMARY",
        requestId: payload.requestId,
        usage: payload.usage,
      });
    }

    return ok({ success: true });
  }

  private verifySignature(
    rawBody: string,
    timestamp: string,
    signature: string,
  ): Result<void, UseCaseError> {
    // Validate timestamp
    const timestampMs = parseInt(timestamp, 10);
    if (isNaN(timestampMs)) {
      return err(unauthorizedError("Invalid timestamp format"));
    }

    const now = Date.now();
    if (
      Math.abs(now - timestampMs) >
      HandleEntrySummaryCallback.TIMESTAMP_TOLERANCE_MS
    ) {
      return err(unauthorizedError("Timestamp expired or too far in future"));
    }

    // Compute expected signature
    const expectedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(expectedPayload)
      .digest("hex");

    // First check length (timingSafeEqual requires same length)
    if (signature.length !== expectedSignature.length) {
      return err(unauthorizedError("Invalid signature"));
    }

    // Constant-time comparison
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    ) {
      return err(unauthorizedError("Invalid signature"));
    }

    return ok(undefined);
  }
}
