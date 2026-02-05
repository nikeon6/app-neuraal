import { Result, ok } from "../../domain/core/Result";
import { Notification } from "../../domain/entities/Notification";
import { EntryRepository } from "../ports/EntryRepository";
import { SummaryRequestRepository } from "../ports/SummaryRequestRepository";
import { NotificationRepository } from "../ports/NotificationRepository";
import { AutomationPort } from "../ports/AutomationPort";
import { UseCaseError } from "../core/UseCaseError";

/**
 * Input for ProcessEntrySummaryJob use case.
 */
export interface ProcessEntrySummaryJobInput {
  requestId: string;
  userId: string;
  entryId: string;
}

/**
 * Result of processing a summary job.
 */
export interface ProcessEntrySummaryJobResult {
  processed: boolean;
  status: "submitted" | "failed" | "skipped";
  reason?: string;
}

/**
 * Use case: Process a summary job from the queue.
 *
 * Called by: BullMQ worker
 *
 * Logic:
 * 1. Load summary request from DB - skip if not found
 * 2. Check request is not in terminal state (done/failed) - skip if terminal
 * 3. Load entry and verify ownership - skip if not found or wrong owner
 * 4. Call automation service (n8n) with callbackUrl
 * 5. If success → mark request as submitted
 * 6. If failure → mark request as failed, create SUMMARY_FAILED notification
 */
export class ProcessEntrySummaryJob {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly summaryRequestRepository: SummaryRequestRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly automationPort: AutomationPort,
    private readonly callbackUrl: string,
    private readonly generateId: () => string = () => crypto.randomUUID()
  ) {}

  async execute(
    input: ProcessEntrySummaryJobInput
  ): Promise<Result<ProcessEntrySummaryJobResult, UseCaseError>> {
    const { requestId, userId, entryId } = input;

    // 1. Load summary request
    const request = await this.summaryRequestRepository.findById(requestId);
    if (!request) {
      return ok({
        processed: false,
        status: "skipped",
        reason: "Request not found (deleted)",
      });
    }

    // 2. Check request is not terminal
    if (request.isTerminal()) {
      return ok({
        processed: false,
        status: "skipped",
        reason: `Request is in terminal state (${request.status.toString()})`,
      });
    }

    // 3. Load entry and verify ownership
    const entry = await this.entryRepository.findById(entryId);
    if (!entry) {
      // Mark request as failed since entry was deleted
      await this.summaryRequestRepository.update(request.markFailed());
      return ok({
        processed: false,
        status: "skipped",
        reason: "Entry not found (deleted)",
      });
    }

    if (entry.userId !== userId) {
      // Security: don't process if ownership doesn't match
      await this.summaryRequestRepository.update(request.markFailed());
      return ok({
        processed: false,
        status: "skipped",
        reason: "Entry ownership mismatch",
      });
    }

    // 4. Call automation service
    const automationResult = await this.automationPort.requestEntrySummary({
      requestId,
      userId,
      entryId,
      callbackUrl: this.callbackUrl,
    });

    if (automationResult.success) {
      // 5. Success → mark as submitted
      const submittedRequest = request.markSubmitted();
      await this.summaryRequestRepository.update(submittedRequest);

      return ok({
        processed: true,
        status: "submitted",
      });
    } else {
      // 6. Failure → mark as failed and create notification
      const failedRequest = request.markFailed();
      await this.summaryRequestRepository.update(failedRequest);

      const notificationResult = Notification.create({
        id: this.generateId(),
        userId,
        type: "SUMMARY_FAILED",
        title: "Summary Failed",
        message: `Failed to generate summary: ${automationResult.error || "Unknown error"}`,
        status: "unread",
        payload: {
          requestId,
          entryId,
          error: automationResult.error,
        },
        createdAt: new Date(),
      });

      if (notificationResult.isOk()) {
        await this.notificationRepository.create(notificationResult.value);
      }

      return ok({
        processed: true,
        status: "failed",
        reason: automationResult.error,
      });
    }
  }
}
