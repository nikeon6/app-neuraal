import { Result, ok, err } from "@/domain/core/Result";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { ObjectStoragePort } from "../../ports/ObjectStoragePort";
import type { OcrPort } from "../../ports/OcrPort";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  validationError,
  notFoundError,
  internalError,
} from "../../core/UseCaseError";

/**
 * Input for ExtractImageText use case.
 */
export interface ExtractImageTextInput {
  userId: string;
  entryId: string;
  attachmentId: string;
  /** Optional prompt override — allows different analysis modes (scan text, describe, etc.) */
  prompt?: string;
}

/**
 * Output for ExtractImageText use case.
 */
export interface ExtractImageTextOutput {
  attachmentId: string;
  extractedText: string;
}

/**
 * ExtractImageText use case.
 *
 * Downloads an image attachment from object storage, sends it to an
 * OCR provider (e.g. Ollama Vision), and returns the extracted text.
 *
 * Security: validates ownership of both the entry and the attachment.
 */
export class ExtractImageText {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly objectStorage: ObjectStoragePort,
    private readonly ocrProvider: OcrPort
  ) {}

  async execute(
    input: ExtractImageTextInput
  ): Promise<Result<ExtractImageTextOutput, UseCaseError>> {
    // 1. Validate input
    if (!input.userId?.trim()) {
      return err(validationError("userId cannot be empty"));
    }
    if (!input.entryId?.trim()) {
      return err(validationError("entryId cannot be empty"));
    }
    if (!input.attachmentId?.trim()) {
      return err(validationError("attachmentId cannot be empty"));
    }

    const userId = input.userId.trim();
    const entryId = input.entryId.trim();
    const attachmentId = input.attachmentId.trim();

    // 2. Validate entry exists and belongs to user
    const entry = await this.entryRepository.findById(entryId);
    if (!entry || entry.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    // 3. Validate attachment exists, belongs to entry, and is ready
    const attachment = await this.attachmentRepository.findById(attachmentId);
    if (!attachment || attachment.entryId !== entryId) {
      return err(notFoundError("Attachment not found"));
    }
    if (attachment.userId !== userId) {
      return err(notFoundError("Attachment not found"));
    }
    if (!attachment.status.isReady()) {
      return err(
        validationError("Attachment is not ready (status: " + attachment.status.toString() + ")")
      );
    }

    // 4. Validate attachment is an image
    const mimeType = attachment.mimeType.toString();
    if (!mimeType.startsWith("image/")) {
      return err(validationError("Attachment is not an image"));
    }

    // 5. Download image from storage
    let imageBuffer: Buffer;
    try {
      imageBuffer = await this.objectStorage.getObjectBuffer(
        attachment.storageKey.toString()
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error";
      return err(internalError(`Failed to download image: ${message}`));
    }

    // 6. Convert to base64 and call OCR
    const imageBase64 = imageBuffer.toString("base64");
    let extractedText: string;
    try {
      extractedText = await this.ocrProvider.extractText(imageBase64, mimeType, input.prompt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown OCR error";
      return err(internalError(`OCR processing failed: ${message}`));
    }

    return ok({
      attachmentId,
      extractedText: extractedText.trim(),
    });
  }
}
