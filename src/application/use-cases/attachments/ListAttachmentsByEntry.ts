import { Result, ok, err } from "@/domain/core/Result";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { AttachmentRepository } from "../../ports/AttachmentRepository";
import type { AttachmentDTO } from "../../dto/AttachmentDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for ListAttachmentsByEntry use case.
 */
export interface ListAttachmentsByEntryInput {
  userId: string;
  entryId: string;
}

/**
 * Output includes attachments and quota usage data.
 */
export interface ListAttachmentsByEntryResult {
  attachments: AttachmentDTO[];
  usage: {
    entryBytesUsed: number;
    entryLimitBytes: number;
    userBytesUsed: number;
    userLimitBytes: number;
  };
}

/**
 * ListAttachmentsByEntry use case.
 * Returns all non-deleted attachments for an entry, plus usage/quota info.
 */
export class ListAttachmentsByEntry {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly limits: { entryLimitBytes: number; userLimitBytes: number }
  ) {}

  async execute(
    input: ListAttachmentsByEntryInput
  ): Promise<Result<ListAttachmentsByEntryResult, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate entryId
    if (!input.entryId || input.entryId.trim().length === 0) {
      return err(validationError("entryId cannot be empty"));
    }

    const userId = input.userId.trim();
    const entryId = input.entryId.trim();

    // Verify entry exists and belongs to user
    const entry = await this.entryRepository.findById(entryId);
    if (!entry || entry.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    // Fetch attachments and usage in parallel
    const [attachments, entryBytesUsed, userBytesUsed] = await Promise.all([
      this.attachmentRepository.findByEntryId(entryId),
      this.attachmentRepository.sumActiveBytesByEntry(entryId),
      this.attachmentRepository.sumActiveBytesByUser(userId),
    ]);

    // Map to DTOs
    const dtos: AttachmentDTO[] = attachments.map((a) => {
      const json = a.toJSON();
      return {
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
      };
    });

    return ok({
      attachments: dtos,
      usage: {
        entryBytesUsed,
        entryLimitBytes: this.limits.entryLimitBytes,
        userBytesUsed,
        userLimitBytes: this.limits.userLimitBytes,
      },
    });
  }
}
