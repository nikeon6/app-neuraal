import { Result, ok, err } from "@/domain/core/Result";
import type { TranscriptRequestRepository } from "../../ports/TranscriptRequestRepository";
import type { NotificationRepository } from "../../ports/NotificationRepository";
import type { AutomationPort } from "../../ports/AutomationPort";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, internalError } from "../../core/UseCaseError";
import { Notification } from "@/domain/entities/Notification";

export interface ProcessEntryTranscriptJobInput {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

export interface ProcessEntryTranscriptJobResult {
  status: "submitted" | "failed" | "skipped";
  reason?: string;
}

export class ProcessEntryTranscriptJob {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly transcriptRequestRepository: TranscriptRequestRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly automationPort: AutomationPort,
    private readonly callbackUrl: string,
    private readonly generateId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(
    input: ProcessEntryTranscriptJobInput,
  ): Promise<Result<ProcessEntryTranscriptJobResult, UseCaseError>> {
    const { requestId, userId, entryId, youtubeUrl } = input;

    // Validate request still exists and is pending
    const request = await this.transcriptRequestRepository.findById(requestId);
    if (!request) {
      return ok({ status: "skipped", reason: "Request not found" });
    }
    if (request.status !== "pending") {
      return ok({
        status: "skipped",
        reason: `Request status is ${request.status}`,
      });
    }

    // Get entry for title
    const entry = await this.entryRepository.findById(entryId);
    if (!entry) {
      await this.transcriptRequestRepository.markFailed(requestId, new Date());
      return err(notFoundError("Entry not found"));
    }

    // Call n8n
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
      await this.transcriptRequestRepository.markSubmitted(
        requestId,
        new Date(),
      );
      return ok({ status: "submitted" });
    }

    // Failed
    await this.transcriptRequestRepository.markFailed(requestId, new Date(), {
      error: automationResult.error,
    });

    const notifResult = Notification.create({
      id: this.generateId(),
      userId,
      type: "TRANSCRIPTION_FAILED",
      title: "Transcript failed",
      message: `Failed to start transcription: ${automationResult.error ?? "Unknown error"}`,
      status: "unread",
      payload: { requestId, entryId },
      createdAt: new Date(),
    });
    if (notifResult.isOk()) {
      await this.notificationRepository.create(notifResult.value);
    }

    return err(internalError(automationResult.error ?? "Automation failed"));
  }
}
