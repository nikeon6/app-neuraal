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
    const transcriptText = (
      payload.transcriptText ?? payload.transcription
    )?.trim();

    if (!requestId || !transcriptText) {
      return err(validationError("requestId and transcriptText are required"));
    }

    // Validate request
    const request = await this.transcriptRequestRepository.findById(requestId);
    if (!request) {
      return err(notFoundError("Transcript request not found"));
    }

    if (request.userId !== userId) {
      return err(validationError("User ID mismatch in callback"));
    }
    if (request.entryId !== entryId) {
      return err(validationError("Entry ID mismatch in callback"));
    }

    // Idempotency guard
    if (request.status === "done") {
      return ok(undefined);
    }

    const entry = await this.entryRepository.findById(entryId);
    if (!entry) {
      return err(notFoundError("Entry not found"));
    }

    // Inject transcript in Tiptap content so editor can render it inline.
    const updatedContent = this.injectTranscription(
      entry.content.toJSON(),
      request.youtubeUrl,
      transcriptText,
    );
    if (!updatedContent) {
      return err(
        validationError(
          "YouTube node not found in entry content for transcription injection",
        ),
      );
    }

    await this.entryRepository.updateContent(entryId, updatedContent);
    // Keep transcriptText column updated for compatibility/analytics.
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
      payload: { requestId, entryId, youtubeUrl: request.youtubeUrl },
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

  private injectTranscription(
    content: Record<string, unknown>,
    youtubeUrl: string,
    transcription: string,
  ): Record<string, unknown> | null {
    const doc = structuredClone(content);
    const injected = this.walkAndInject(doc, youtubeUrl, transcription);
    return injected ? doc : null;
  }

  private walkAndInject(
    node: Record<string, unknown>,
    youtubeUrl: string,
    transcription: string,
  ): boolean {
    if (node.type === "youtube" && node.attrs) {
      const attrs = node.attrs as Record<string, unknown>;
      if (this.urlsMatch(attrs.src as string | undefined, youtubeUrl)) {
        attrs.transcription = transcription;
        return true;
      }
    }

    const children = node.content as unknown[];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (
          typeof child === "object" &&
          child !== null &&
          this.walkAndInject(
            child as Record<string, unknown>,
            youtubeUrl,
            transcription,
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private urlsMatch(a: string | undefined, b: string): boolean {
    if (!a) return false;
    const idA = this.extractVideoId(a);
    const idB = this.extractVideoId(b);
    if (idA && idB) return idA === idB;
    return a === b;
  }

  private extractVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.slice(1);
      }
      if (
        parsed.hostname.includes("youtube.com") ||
        parsed.hostname.includes("youtube-nocookie.com")
      ) {
        const v = parsed.searchParams.get("v");
        if (v) return v;
        if (parsed.pathname.startsWith("/embed/")) {
          return parsed.pathname.split("/embed/")[1];
        }
        if (parsed.pathname.startsWith("/shorts/")) {
          return parsed.pathname.split("/shorts/")[1];
        }
      }
    } catch {
      // Invalid URL
    }
    return null;
  }
}
