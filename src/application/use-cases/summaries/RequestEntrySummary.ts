import { Result, ok, err } from "../../../domain/core/Result";
import { EntrySummaryRequest } from "../../../domain/entities/EntrySummaryRequest";
import { Notification } from "../../../domain/entities/Notification";
import { MonthKey } from "../../../domain/value-objects/MonthKey";
import { EntryRepository } from "../../ports/EntryRepository";
import { NotificationRepository } from "../../ports/NotificationRepository";
import { SummaryRequestRepository } from "../../ports/SummaryRequestRepository";
import { QueuePort } from "../../ports/QueuePort";
import { AiUsageRepository } from "../../ports/AiUsageRepository";
import { ClockPort } from "../../ports/ClockPort";
import {
  UseCaseError,
  notFoundError,
  conflictError,
} from "../../core/UseCaseError";

/**
 * Input for RequestEntrySummary use case.
 * plainTextForSummary: when set (e.g. truncated), sent to n8n instead of entry content.
 */
export interface RequestEntrySummaryInput {
  userId: string;
  entryId: string;
  plainTextForSummary?: string;
}

/**
 * Output for RequestEntrySummary use case.
 */
export interface RequestEntrySummaryOutput {
  requestId: string;
  notificationId: string;
}

/**
 * Use case: Request a summary for an entry.
 *
 * Called by: POST /api/entries/:id/summarize
 *
 * Logic:
 * 1. Validate entry exists and belongs to user
 * 2. Check for existing active request (pending/submitted) - return CONFLICT if found
 * 3. Create EntrySummaryRequest with pending status
 * 4. Create SUMMARY_IN_PROGRESS notification (unread)
 * 5. Enqueue summary job
 * 6. Return requestId and notificationId (202 Accepted)
 */
export class RequestEntrySummary {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly summaryRequestRepository: SummaryRequestRepository,
    private readonly queuePort: QueuePort,
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort,
    private readonly generateRequestId: () => string = () => crypto.randomUUID(),
    private readonly generateNotificationId: () => string = () =>
      crypto.randomUUID()
  ) {}

  async execute(
    input: RequestEntrySummaryInput
  ): Promise<Result<RequestEntrySummaryOutput, UseCaseError>> {
    const { userId, entryId, plainTextForSummary } = input;

    // 1. Validate entry exists and belongs to user
    const entry = await this.entryRepository.findById(entryId);
    if (!entry || entry.userId !== userId) {
      return err(notFoundError("Entry not found or access denied"));
    }

    // 2. Check for existing active request
    const activeRequest =
      await this.summaryRequestRepository.findActiveByEntryId(entryId);
    if (activeRequest) {
      return err(
        conflictError("A summary request is already in progress for this entry")
      );
    }

    const requestId = this.generateRequestId();
    const notificationId = this.generateNotificationId();
    const now = new Date();

    // 3. Create EntrySummaryRequest (with meta if truncated)
    const meta =
      plainTextForSummary !== undefined
        ? { truncated: true, plainTextForSummary }
        : undefined;
    const summaryRequest = EntrySummaryRequest.createNew(
      requestId,
      userId,
      entryId,
      meta
    );
    await this.summaryRequestRepository.save(summaryRequest);

    // 4. Reserve quota (consume 1); revert if enqueue fails
    const monthKey = MonthKey.fromDate(this.clock.now()).toString();
    await this.aiUsageRepository.incrementRequests(
      userId,
      "SUMMARY",
      monthKey,
      1
    );

    try {
      // 5. Create SUMMARY_IN_PROGRESS notification
      const notificationResult = Notification.create({
        id: notificationId,
        userId,
        type: "SUMMARY_IN_PROGRESS",
        title: "Summary in Progress",
        message: `Generating summary for "${entry.title.toString()}"...`,
        status: "unread",
        payload: { requestId, entryId },
        createdAt: now,
      });

      if (notificationResult.isOk()) {
        await this.notificationRepository.create(notificationResult.value);
      }

      // 6. Enqueue summary job
      await this.queuePort.enqueueEntrySummary({
        requestId,
        userId,
        entryId,
        plainTextForSummary,
      });

      return ok({
        requestId,
        notificationId,
      });
    } catch {
      // Revert quota if we failed before n8n
      await this.aiUsageRepository.incrementRequests(
        userId,
        "SUMMARY",
        monthKey,
        -1
      );
      throw new Error("Failed to enqueue summary job");
    }
  }
}
