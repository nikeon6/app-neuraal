import { Result, ok, err } from "../../../domain/core/Result";
import { Notification } from "../../../domain/entities/Notification";
import { EntryRepository } from "../../ports/EntryRepository";
import { TranscriptionRequestRepository } from "../../ports/TranscriptionRequestRepository";
import { NotificationRepository } from "../../ports/NotificationRepository";
import {
  UseCaseError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "../../core/UseCaseError";
import crypto from "node:crypto";

/**
 * Callback payload from n8n.
 */
export interface TranscriptionCallbackPayload {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
  transcription: string;
}

/**
 * Input for HandleTranscriptionCallback use case.
 */
export interface HandleTranscriptionCallbackInput {
  rawBody: string;
  timestamp: string;
  signature: string;
  payload: TranscriptionCallbackPayload;
}

/**
 * Output for HandleTranscriptionCallback use case.
 */
export interface HandleTranscriptionCallbackOutput {
  success: boolean;
  alreadyProcessed?: boolean;
}

/**
 * Use case: Handle callback from n8n with transcription result.
 *
 * Called by: POST /api/automations/entry-transcription/callback
 *
 * Logic:
 * 1. Verify HMAC signature (X-Timestamp + X-Signature)
 * 2. Validate timestamp is not expired (< 5 minutes)
 * 3. Load transcription request — NOT_FOUND if not exists
 * 4. Idempotency: if already done, return success
 * 5. Validate userId matches request
 * 6. Validate entryId matches request
 * 7. Validate transcription text is not empty
 * 8. Store transcription in entry content (update YouTube node attrs)
 * 9. Mark request as done
 * 10. Create TRANSCRIPTION_DONE notification
 */
export class HandleTranscriptionCallback {
  private static readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly transcriptionRequestRepository: TranscriptionRequestRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly webhookSecret: string,
    private readonly generateId: () => string = () => crypto.randomUUID()
  ) {}

  async execute(
    input: HandleTranscriptionCallbackInput
  ): Promise<Result<HandleTranscriptionCallbackOutput, UseCaseError>> {
    const { rawBody, timestamp, signature, payload } = input;

    // 1 & 2. Verify HMAC signature and timestamp
    const signatureResult = this.verifySignature(rawBody, timestamp, signature);
    if (signatureResult.isErr()) {
      return err(signatureResult.error);
    }

    // 3. Load transcription request
    const request = await this.transcriptionRequestRepository.findById(
      payload.requestId
    );
    if (!request) {
      return err(notFoundError("Transcription request not found"));
    }

    // 4. Idempotency check
    if (request.status.isDone()) {
      return ok({ success: true, alreadyProcessed: true });
    }

    // 5. Validate userId matches
    if (request.userId !== payload.userId) {
      return err(unauthorizedError("User ID mismatch in callback"));
    }

    // 6. Validate entryId matches
    if (request.entryId !== payload.entryId) {
      return err(
        validationError(
          "Entry ID mismatch: payload does not match original request"
        )
      );
    }

    // 7. Validate transcription text
    if (!payload.transcription || payload.transcription.trim().length === 0) {
      return err(validationError("Transcription text cannot be empty"));
    }

    const { entryId } = request;

    // 8. Store transcription in entry content (inject into YouTube node)
    const entry = await this.entryRepository.findById(entryId);
    if (!entry) {
      return err(notFoundError("Entry not found"));
    }

    const updatedContent = this.injectTranscription(
      entry.content.toJSON(),
      request.youtubeUrl,
      payload.transcription.trim()
    );

    await this.entryRepository.updateContent(entryId, updatedContent);

    // 9. Mark request as done
    const doneRequest = request.markDone();
    await this.transcriptionRequestRepository.update(doneRequest);

    // 10. Create TRANSCRIPTION_DONE notification
    const entryTitle = entry.title.toString();

    const notificationResult = Notification.create({
      id: this.generateId(),
      userId: request.userId,
      type: "TRANSCRIPTION_DONE",
      title: "Transcription Complete",
      message: `Video transcription ready for "${entryTitle}"`,
      status: "unread",
      payload: {
        requestId: payload.requestId,
        entryId,
        youtubeUrl: request.youtubeUrl,
      },
      createdAt: new Date(),
    });

    if (notificationResult.isOk()) {
      await this.notificationRepository.create(notificationResult.value);
    }

    return ok({ success: true });
  }

  /**
   * Injects transcription text into the YouTube node inside
   * a Tiptap (ProseMirror) content JSON document.
   *
   * Traverses the document tree recursively and sets a `transcription`
   * attribute on the first YouTube node whose `src` matches the given URL.
   */
  private injectTranscription(
    content: Record<string, unknown>,
    youtubeUrl: string,
    transcription: string
  ): Record<string, unknown> {
    const doc = structuredClone(content);
    this.walkAndInject(doc, youtubeUrl, transcription);
    return doc;
  }

  /** Recursively walks ProseMirror doc nodes. */
  private walkAndInject(
    node: Record<string, unknown>,
    youtubeUrl: string,
    transcription: string
  ): boolean {
    // Check if this is a YouTube node with matching src
    if (node.type === "youtube" && node.attrs) {
      const attrs = node.attrs as Record<string, unknown>;
      if (this.urlsMatch(attrs.src as string, youtubeUrl)) {
        attrs.transcription = transcription;
        return true; // Stop after first match
      }
    }

    // Recurse into children
    const children = node.content as unknown[];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (
          typeof child === "object" &&
          child !== null &&
          this.walkAndInject(
            child as Record<string, unknown>,
            youtubeUrl,
            transcription
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Compares two YouTube URLs by extracting their video ID.
   * This handles URL format variations (youtube.com, youtu.be, etc.).
   */
  private urlsMatch(a: string | undefined, b: string): boolean {
    if (!a) return false;
    const idA = this.extractVideoId(a);
    const idB = this.extractVideoId(b);
    if (idA && idB) return idA === idB;
    // Fallback: exact string match
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
      // Not a valid URL
    }
    return null;
  }

  private verifySignature(
    rawBody: string,
    timestamp: string,
    signature: string
  ): Result<void, UseCaseError> {
    const timestampMs = Number.parseInt(timestamp, 10);
    if (Number.isNaN(timestampMs)) {
      return err(unauthorizedError("Invalid timestamp format"));
    }

    const now = Date.now();
    if (
      Math.abs(now - timestampMs) >
      HandleTranscriptionCallback.TIMESTAMP_TOLERANCE_MS
    ) {
      return err(unauthorizedError("Timestamp expired or too far in future"));
    }

    const expectedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(expectedPayload)
      .digest("hex");

    if (signature.length !== expectedSignature.length) {
      return err(unauthorizedError("Invalid signature"));
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return err(unauthorizedError("Invalid signature"));
    }

    return ok(undefined);
  }
}
