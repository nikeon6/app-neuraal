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

function isSupportedYouTubeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    const isYoutubeHost =
      host === "youtu.be" ||
      host === "www.youtu.be" ||
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "www.youtube-nocookie.com";

    if (!isYoutubeHost) {
      return false;
    }

    // short link: https://youtu.be/<id>
    if (host.includes("youtu.be")) {
      return path.length > 1;
    }

    // watch link: /watch?v=<id>
    const watchId = parsed.searchParams.get("v");
    if (
      path === "/watch" &&
      typeof watchId === "string" &&
      watchId.length > 0
    ) {
      return true;
    }

    // shorts link: /shorts/<id>
    if (path.startsWith("/shorts/") && path.length > "/shorts/".length) {
      return true;
    }

    // embed link: /embed/<id> (youtube + youtube-nocookie)
    if (path.startsWith("/embed/") && path.length > "/embed/".length) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

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
    const normalizedUrl = youtubeUrl.trim();

    // Validate YouTube URL
    if (!normalizedUrl || !isSupportedYouTubeUrl(normalizedUrl)) {
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
      youtubeUrl: normalizedUrl,
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
        youtubeUrl: normalizedUrl,
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
