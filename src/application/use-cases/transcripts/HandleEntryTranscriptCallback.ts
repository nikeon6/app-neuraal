import { Result, ok, err } from "@/domain/core/Result";
import type { TranscriptRequestRepository } from "../../ports/TranscriptRequestRepository";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { NotificationRepository } from "../../ports/NotificationRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, validationError } from "../../core/UseCaseError";
import { Notification } from "@/domain/entities/Notification";
import { RecordAiUsageFromCallback } from "../ai/RecordAiUsageFromCallback";

export interface TranscriptCallbackPayload {
  requestId: string;
  userId: string;
  entryId: string;
  transcriptText?: string;
  transcription?: string;
  format?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    model?: string;
  };
}

export class HandleEntryTranscriptCallback {
  constructor(
    private readonly transcriptRequestRepository: TranscriptRequestRepository,
    private readonly entryRepository: EntryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly generateId: () => string = () => crypto.randomUUID(),
    private readonly recordAiUsage?: RecordAiUsageFromCallback,
  ) {}

  async execute(
    payload: TranscriptCallbackPayload,
  ): Promise<Result<void, UseCaseError>> {
    const { requestId, userId, entryId } = payload;
    const transcriptText = payload.transcriptText ?? payload.transcription;

    if (!requestId || !transcriptText) {
      return err(validationError("requestId and transcriptText are required"));
    }

    // Validate request
    const request = await this.transcriptRequestRepository.findById(requestId);
    if (!request) {
      return err(notFoundError("Transcript request not found"));
    }

    // Save transcript to Entry
    await this.entryRepository.updateTranscript(entryId, transcriptText);

    // Mark request done
    const now = new Date();
    await this.transcriptRequestRepository.markDone(requestId, now, {
      format: payload.format,
      textLength: transcriptText.length,
    });

    // Create done notification
    const notifResult = Notification.create({
      id: this.generateId(),
      userId,
      type: "TRANSCRIPTION_DONE",
      title: "Transcript ready",
      message: "Your YouTube transcript has been generated successfully.",
      status: "unread",
      payload: { requestId, entryId },
      createdAt: now,
    });
    if (notifResult.isOk()) {
      await this.notificationRepository.create(notifResult.value);
    }

    // Record AI usage if available
    if (this.recordAiUsage && payload.usage) {
      await this.recordAiUsage.execute({
        userId,
        action: "TRANSCRIPT_YOUTUBE",
        requestId,
        usage: payload.usage,
      });
    }

    return ok(undefined);
  }
}
