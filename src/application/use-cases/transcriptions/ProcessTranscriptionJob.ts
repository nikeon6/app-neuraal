import { Result, ok } from "../../../domain/core/Result";
import { Notification } from "../../../domain/entities/Notification";
import { EntryRepository } from "../../ports/EntryRepository";
import { TranscriptionRequestRepository } from "../../ports/TranscriptionRequestRepository";
import { NotificationRepository } from "../../ports/NotificationRepository";
import { AutomationPort } from "../../ports/AutomationPort";
import { UseCaseError } from "../../core/UseCaseError";

/**
 * Input for ProcessTranscriptionJob use case.
 */
export interface ProcessTranscriptionJobInput {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

/**
 * Result of processing a transcription job.
 */
export interface ProcessTranscriptionJobResult {
  processed: boolean;
  status: "submitted" | "failed" | "skipped";
  reason?: string;
}

/**
 * Use case: Process a transcription job from the queue.
 *
 * Called by: BullMQ worker
 *
 * Logic:
 * 1. Load transcription request from DB — skip if not found
 * 2. Check request is not in terminal state — skip if terminal
 * 3. Load entry and verify ownership — skip if not found or wrong owner
 * 4. Call automation service (n8n) with YouTube URL and callbackUrl
 * 5. If success → mark request as submitted
 * 6. If failure → mark as failed, create TRANSCRIPTION_FAILED notification
 */
export class ProcessTranscriptionJob {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly transcriptionRequestRepository: TranscriptionRequestRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly automationPort: AutomationPort,
    private readonly callbackUrl: string,
    private readonly generateId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(
    input: ProcessTranscriptionJobInput,
  ): Promise<Result<ProcessTranscriptionJobResult, UseCaseError>> {
    const { requestId, userId, entryId, youtubeUrl } = input;

    // 1. Load transcription request
    const request =
      await this.transcriptionRequestRepository.findById(requestId);
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
      await this.transcriptionRequestRepository.update(request.markFailed());
      return ok({
        processed: false,
        status: "skipped",
        reason: "Entry not found (deleted)",
      });
    }

    if (entry.userId !== userId) {
      await this.transcriptionRequestRepository.update(request.markFailed());
      return ok({
        processed: false,
        status: "skipped",
        reason: "Entry ownership mismatch",
      });
    }

    // 4. Call automation service (n8n)
    const automationResult =
      await this.automationPort.requestEntryTranscription({
        requestId,
        userId,
        entryId,
        youtubeUrl,
        callbackUrl: this.callbackUrl,
        entryTitle: entry.title.toString(),
      });

    if (automationResult.success) {
      // 5. Success → mark as submitted
      const submittedRequest = request.markSubmitted();
      await this.transcriptionRequestRepository.update(submittedRequest);

      return ok({
        processed: true,
        status: "submitted",
      });
    } else {
      // 6. Failure → mark as failed and create notification
      const failedRequest = request.markFailed();
      await this.transcriptionRequestRepository.update(failedRequest);

      const notificationResult = Notification.create({
        id: this.generateId(),
        userId,
        type: "TRANSCRIPTION_FAILED",
        title: "Transcription Failed",
        message: `Failed to transcribe video: ${automationResult.error || "Unknown error"}`,
        status: "unread",
        payload: {
          requestId,
          entryId,
          youtubeUrl,
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
