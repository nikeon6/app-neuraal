import { Result, ok, err } from "@/domain/core/Result";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { ObjectStoragePort } from "../../ports/ObjectStoragePort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for DeleteAttachment use case.
 */
export interface DeleteAttachmentInput {
  userId: string;
  attachmentId: string;
}

/**
 * DeleteAttachment use case.
 * Marks attachment as deleted and removes file from storage.
 */
export class DeleteAttachment {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly objectStorage: ObjectStoragePort
  ) {}

  async execute(
    input: DeleteAttachmentInput
  ): Promise<Result<void, UseCaseError>> {
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

    // Check existence, ownership, and not already deleted
    if (!attachment || attachment.userId !== userId || attachment.status.isDeleted()) {
      return err(notFoundError("Attachment not found"));
    }

    // Delete from object storage
    await this.objectStorage.deleteObject(attachment.storageKey.toString());

    // Mark as deleted in repository
    const deletedAttachment = attachment.markDeleted();
    await this.attachmentRepository.update(deletedAttachment);

    return ok(undefined);
  }
}
