import { Result, ok, err } from "@/domain/core/Result";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { NotificationRepository } from "../../ports/NotificationRepository";
import type { TranscriptRequestRepository } from "../../ports/TranscriptRequestRepository";
import type { QueuePort } from "../../ports/QueuePort";
import type { AiUsageRepository } from "../../ports/AiUsageRepository";
import type { ClockPort } from "../../ports/ClockPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, validationError } from "../../core/UseCaseError";
import { Notification } from "@/domain/entities/Notification";
import { MonthKey } from "@/domain/value-objects/MonthKey";

export interface RequestEntryTranscriptInput {
  userId: string;
  entryId: string;
  youtubeUrl: string;
}

export interface RequestEntryTranscriptOutput {
  requestId: string;
  notificationId: string;
}

const YOUTUBE_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/;

export class RequestEntryTranscript {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly transcriptRequestRepository: TranscriptRequestRepository,
    private readonly queuePort: QueuePort,
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly clock: ClockPort,
    private readonly generateId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(
    input: RequestEntryTranscriptInput,
  ): Promise<Result<RequestEntryTranscriptOutput, UseCaseError>> {
    const { userId, entryId, youtubeUrl } = input;

    // Validate YouTube URL
    if (!youtubeUrl || !YOUTUBE_REGEX.test(youtubeUrl.trim())) {
      return err(
        validationError(
          "Invalid YouTube URL. Must be a youtube.com or youtu.be link.",
        ),
      );
    }

    // Validate entry ownership
    const entry = await this.entryRepository.findById(entryId);
    if (entry?.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    const now = this.clock.now();
    const requestId = this.generateId();
    const notificationId = this.generateId();

    // Create transcript request
    await this.transcriptRequestRepository.create({
      id: requestId,
      userId,
      entryId,
      youtubeUrl: youtubeUrl.trim(),
      status: "pending",
      createdAt: now,
    });

    // Create notification
    const notifResult = Notification.create({
      id: notificationId,
      userId,
      type: "TRANSCRIPTION_IN_PROGRESS",
      title: "Transcript in progress",
      message: "Your YouTube transcript is being generated...",
      status: "unread",
      payload: { requestId, entryId, youtubeUrl },
      createdAt: now,
    });
    if (notifResult.isOk()) {
      await this.notificationRepository.create(notifResult.value);
    }

    // Increment monthly usage
    const monthKey = MonthKey.fromDate(now).toString();
    await this.aiUsageRepository.incrementRequests(
      userId,
      "TRANSCRIPT_YOUTUBE",
      monthKey,
      1,
    );

    // Enqueue job
    try {
      await this.queuePort.enqueueEntryTranscription({
        requestId,
        userId,
        entryId,
        youtubeUrl: youtubeUrl.trim(),
      });
    } catch (enqueueError) {
      // Revert usage increment
      await this.aiUsageRepository.incrementRequests(
        userId,
        "TRANSCRIPT_YOUTUBE",
        monthKey,
        -1,
      );
      throw enqueueError;
    }

    return ok({ requestId, notificationId });
  }
}
