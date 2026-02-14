import { Result, ok, err } from "../../../domain/core/Result";
import { TranscriptionRequest } from "../../../domain/entities/TranscriptionRequest";
import { Notification } from "../../../domain/entities/Notification";
import { EntryRepository } from "../../ports/EntryRepository";
import { NotificationRepository } from "../../ports/NotificationRepository";
import { TranscriptionRequestRepository } from "../../ports/TranscriptionRequestRepository";
import { QueuePort } from "../../ports/QueuePort";
import {
  UseCaseError,
  notFoundError,
  conflictError,
  validationError,
} from "../../core/UseCaseError";

/**
 * Input for RequestTranscription use case.
 */
export interface RequestTranscriptionInput {
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

/**
 * Output for RequestTranscription use case.
 */
export interface RequestTranscriptionOutput {
  requestId: string;
  notificationId: string;
}

/**
 * Use case: Request a transcription for a YouTube video embedded in an entry.
 *
 * Called by: POST /api/entries/:id/transcription
 *
 * Logic:
 * 1. Validate youtubeUrl is not empty
 * 2. Validate entry exists and belongs to user
 * 3. Check for existing active request (pending/submitted) for same entry+url — CONFLICT
 * 4. Create TranscriptionRequest with pending status
 * 5. Create TRANSCRIPTION_IN_PROGRESS notification (unread)
 * 6. Enqueue transcription job
 * 7. Return requestId and notificationId (202 Accepted)
 */
export class RequestTranscription {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly transcriptionRequestRepository: TranscriptionRequestRepository,
    private readonly queuePort: QueuePort,
    private readonly generateRequestId: () => string = () =>
      crypto.randomUUID(),
    private readonly generateNotificationId: () => string = () =>
      crypto.randomUUID(),
  ) {}

  async execute(
    input: RequestTranscriptionInput,
  ): Promise<Result<RequestTranscriptionOutput, UseCaseError>> {
    const { userId, entryId, youtubeUrl } = input;

    // 1. Validate youtubeUrl
    if (!youtubeUrl || youtubeUrl.trim().length === 0) {
      return err(validationError("youtubeUrl is required"));
    }

    // 2. Validate entry exists and belongs to user
    const entry = await this.entryRepository.findById(entryId);
    if (!entry || entry.userId !== userId) {
      return err(notFoundError("Entry not found or access denied"));
    }

    // 3. Check for existing active request for same entry+url
    const activeRequest =
      await this.transcriptionRequestRepository.findActiveByEntryAndUrl(
        entryId,
        youtubeUrl.trim(),
      );
    if (activeRequest) {
      return err(
        conflictError(
          "A transcription request is already in progress for this video",
        ),
      );
    }

    const requestId = this.generateRequestId();
    const notificationId = this.generateNotificationId();
    const now = new Date();

    // 4. Create TranscriptionRequest
    const transcriptionRequest = TranscriptionRequest.createNew(
      requestId,
      userId,
      entryId,
      youtubeUrl.trim(),
    );
    await this.transcriptionRequestRepository.save(transcriptionRequest);

    // 5. Enqueue transcription job — if this fails, clean up the saved request
    //    so it doesn't remain as a "zombie" blocking future requests.
    try {
      await this.queuePort.enqueueEntryTranscription({
        requestId,
        userId,
        entryId,
        youtubeUrl: youtubeUrl.trim(),
      });
    } catch (error: unknown) {
      // Roll back: mark the request as failed so it won't block retries
      const failedRequest = transcriptionRequest.markFailed();
      await this.transcriptionRequestRepository.update(failedRequest);
      const reason =
        error instanceof Error ? error.message : "Unknown queue error";
      return err(
        validationError(
          `Failed to enqueue transcription job (${reason}) — please try again later`,
        ),
      );
    }

    // 6. Create TRANSCRIPTION_IN_PROGRESS notification
    const notificationResult = Notification.create({
      id: notificationId,
      userId,
      type: "TRANSCRIPTION_IN_PROGRESS",
      title: "Transcription in Progress",
      message: `Transcribing video for "${entry.title.toString()}"...`,
      status: "unread",
      payload: { requestId, entryId, youtubeUrl: youtubeUrl.trim() },
      createdAt: now,
    });

    if (notificationResult.isOk()) {
      await this.notificationRepository.create(notificationResult.value);
    }

    // 7. Return IDs for 202 Accepted response
    return ok({
      requestId,
      notificationId,
    });
  }
}
