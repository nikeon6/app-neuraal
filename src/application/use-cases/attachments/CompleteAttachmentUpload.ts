import { Result, ok, err } from "@/domain/core/Result";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { AttachmentDTO } from "../../dto/AttachmentDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for CompleteAttachmentUpload use case.
 */
export interface CompleteAttachmentInput {
  userId: string;
  attachmentId: string;
}

/**
 * CompleteAttachmentUpload use case.
 * Marks an attachment as ready after successful upload.
 * 
 * TODO: Add worker to clean up pending attachments that were never completed
 * (e.g., after 24 hours).
 */
export class CompleteAttachmentUpload {
  constructor(private readonly attachmentRepository: AttachmentRepository) {}

  async execute(
    input: CompleteAttachmentInput
  ): Promise<Result<AttachmentDTO, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate attachmentId
    if (!input.attachmentId || input.attachmentId.trim().length === 0) {
      return err(validationError("attachmentId cannot be empty"));
    }

    const userId = input.userId.trim();
    const attachmentId = input.attachmentId.trim();

    // Find attachment
    const attachment = await this.attachmentRepository.findById(attachmentId);

    // Check existence and ownership
    if (!attachment || attachment.userId !== userId) {
      return err(notFoundError("Attachment not found"));
    }

    // Mark as ready
    const readyAttachment = attachment.markReady();

    // Save to repository
    await this.attachmentRepository.update(readyAttachment);

    // Return DTO
    const json = readyAttachment.toJSON();
    return ok({
      id: json.id,
      userId: json.userId,
      entryId: json.entryId,
      storageKey: json.storageKey,
      filename: json.filename,
      mimeType: json.mimeType,
      sizeBytes: json.sizeBytes,
      kind: json.kind,
      status: json.status,
      createdAt: json.createdAt.toISOString(),
      updatedAt: json.updatedAt.toISOString(),
    });
  }
}
