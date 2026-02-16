import { Result, ok, err } from "@/domain/core/Result";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { ObjectStoragePort } from "../../ports/ObjectStoragePort";
import type { OcrPort } from "../../ports/OcrPort";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import sharp from "sharp";
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

interface ValidatedExtractInput {
  userId: string;
  entryId: string;
  attachmentId: string;
}

type ExistingAttachment = NonNullable<
  Awaited<ReturnType<AttachmentRepository["findById"]>>
>;

/**
 * ExtractImageText use case.
 *
 * Downloads an image attachment from object storage, sends it to an
 * OCR provider (e.g. Ollama Vision), and returns the extracted text.
 *
 * Security: validates ownership of both the entry and the attachment.
 */
export class ExtractImageText {
  private static readonly MAX_IMAGE_DIMENSION = 1024;

  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly objectStorage: ObjectStoragePort,
    private readonly ocrProvider: OcrPort,
  ) {}

  async execute(
    input: ExtractImageTextInput,
  ): Promise<Result<ExtractImageTextOutput, UseCaseError>> {
    // 1) Validate and sanitize input IDs
    const validatedInput = this.validateAndSanitizeInput(input);
    if (validatedInput.isErr()) {
      return err(validatedInput.error);
    }

    // 2) Check ownership and attachment readiness
    const attachmentResult = await this.getValidatedAttachment(
      validatedInput.value,
    );
    if (attachmentResult.isErr()) {
      return err(attachmentResult.error);
    }

    // 3) Read validated attachment metadata
    const { attachment, mimeType } = attachmentResult.value;

    // 4) Download image and optimize size when needed
    const imageBufferResult = await this.downloadAndResizeImage(attachment);
    if (imageBufferResult.isErr()) {
      return err(imageBufferResult.error);
    }

    // 5) Run OCR provider with image payload
    const extractedTextResult = await this.extractTextWithOcr({
      imageBuffer: imageBufferResult.value,
      mimeType,
      prompt: input.prompt,
    });
    if (extractedTextResult.isErr()) {
      return err(extractedTextResult.error);
    }

    // 6) Return normalized successful result
    return ok({
      attachmentId: validatedInput.value.attachmentId,
      extractedText: extractedTextResult.value.trim(),
    });
  }

  private validateAndSanitizeInput(
    input: ExtractImageTextInput,
  ): Result<ValidatedExtractInput, UseCaseError> {
    if (!input.userId?.trim()) {
      return err(validationError("userId cannot be empty"));
    }
    if (!input.entryId?.trim()) {
      return err(validationError("entryId cannot be empty"));
    }
    if (!input.attachmentId?.trim()) {
      return err(validationError("attachmentId cannot be empty"));
    }

    return ok({
      userId: input.userId.trim(),
      entryId: input.entryId.trim(),
      attachmentId: input.attachmentId.trim(),
    });
  }

  private async getValidatedAttachment(
    input: ValidatedExtractInput,
  ): Promise<
    Result<{ attachment: ExistingAttachment; mimeType: string }, UseCaseError>
  > {
    const entry = await this.entryRepository.findById(input.entryId);
    if (entry?.userId !== input.userId) {
      return err(notFoundError("Entry not found"));
    }

    const attachment = await this.attachmentRepository.findById(
      input.attachmentId,
    );
    if (
      attachment?.entryId !== input.entryId ||
      attachment.userId !== input.userId
    ) {
      return err(notFoundError("Attachment not found"));
    }

    if (!attachment.status.isReady()) {
      return err(
        validationError(
          "Attachment is not ready (status: " +
            attachment.status.toString() +
            ")",
        ),
      );
    }

    const mimeType = attachment.mimeType.toString();
    if (!mimeType.startsWith("image/")) {
      return err(validationError("Attachment is not an image"));
    }

    return ok({ attachment, mimeType });
  }

  private async downloadAndResizeImage(
    attachment: ExistingAttachment,
  ): Promise<Result<Buffer, UseCaseError>> {
    let imageBuffer: Buffer;
    try {
      imageBuffer = await this.objectStorage.getObjectBuffer(
        attachment.storageKey.toString(),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error";
      return err(internalError(`Failed to download image: ${message}`));
    }

    try {
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;
      const maxDimension = ExtractImageText.MAX_IMAGE_DIMENSION;

      if (width && height && (width > maxDimension || height > maxDimension)) {
        imageBuffer = await sharp(imageBuffer)
          .resize({
            width: maxDimension,
            height: maxDimension,
            fit: "inside", // Preserve aspect ratio and fit in bounds
            withoutEnlargement: true, // Avoid enlarging smaller images
          })
          .jpeg({ quality: 85, mozjpeg: true }) // Good OCR-quality compression balance
          .toBuffer();
      }
    } catch (resizeError) {
      // Keep original image if optimization fails
      console.warn(
        "Image resize failed, proceeding with original:",
        resizeError instanceof Error ? resizeError.message : resizeError,
      );
    }

    return ok(imageBuffer);
  }

  private async extractTextWithOcr(params: {
    imageBuffer: Buffer;
    mimeType: string;
    prompt?: string;
  }): Promise<Result<string, UseCaseError>> {
    try {
      const extractedText = await this.ocrProvider.extractText(
        params.imageBuffer.toString("base64"),
        params.mimeType,
        params.prompt,
      );

      return ok(extractedText);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown OCR error";
      return err(internalError(`OCR processing failed: ${message}`));
    }
  }
}
