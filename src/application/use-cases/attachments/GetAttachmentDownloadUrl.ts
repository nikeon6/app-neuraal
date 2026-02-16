import { Result, ok, err } from "@/domain/core/Result";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { ObjectStoragePort } from "../../ports/ObjectStoragePort";
import type { DownloadUrlResult } from "../../dto/AttachmentDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for GetAttachmentDownloadUrl use case.
 */
export interface GetDownloadUrlInput {
  userId: string;
  attachmentId: string;
}

/**
 * GetAttachmentDownloadUrl use case.
 * Returns a presigned URL for downloading an attachment.
 * Only works for ready attachments.
 */
export class GetAttachmentDownloadUrl {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly objectStorage: ObjectStoragePort,
  ) {}

  async execute(
    input: GetDownloadUrlInput,
  ): Promise<Result<DownloadUrlResult, UseCaseError>> {
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

    // Check existence, ownership, and status
    if (
      !attachment ||
      attachment.userId !== userId ||
      !attachment.status.isReady()
    ) {
      return err(notFoundError("Attachment not found"));
    }

    // Get presigned GET URL
    const presignedGetUrl = await this.objectStorage.getPresignedGetUrl(
      attachment.storageKey.toString(),
    );

    return ok({ presignedGetUrl });
  }
}
