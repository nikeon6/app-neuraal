import { Result, ok, err } from "@/domain/core/Result";
import { Attachment } from "@/domain/entities/Attachment";
import { StorageKey } from "@/domain/value-objects/StorageKey";
import { Bytes } from "@/domain/value-objects/Bytes";
import { MimeType } from "@/domain/value-objects/MimeType";
import { Filename } from "@/domain/value-objects/Filename";
import { AttachmentKind } from "@/domain/value-objects/AttachmentKind";
import type { EntryRepository } from "../ports/EntryRepository";
import type { AttachmentRepository } from "../ports/AttachmentRepository";
import type { ObjectStoragePort } from "../ports/ObjectStoragePort";
import type { InitAttachmentResult } from "../dto/AttachmentDTO";
import type { UseCaseError } from "../core/UseCaseError";
import { validationError, notFoundError, quotaExceededError } from "../core/UseCaseError";

/**
 * Configuration for attachment quotas.
 */
export interface AttachmentQuotaConfig {
  maxEntryAttachmentSizeBytes: Bytes;
  maxUserStorageQuotaBytes: Bytes;
}

/**
 * Input for InitAttachmentUpload use case.
 */
export interface InitAttachmentInput {
  userId: string;
  entryId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "inline" | "file";
}

/**
 * Generates a unique ID for an attachment.
 */
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * InitAttachmentUpload use case.
 * Creates a pending attachment and returns a presigned URL for upload.
 */
export class InitAttachmentUpload {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly attachmentRepository: AttachmentRepository,
    private readonly objectStorage: ObjectStoragePort,
    private readonly config: AttachmentQuotaConfig
  ) {}

  async execute(
    input: InitAttachmentInput
  ): Promise<Result<InitAttachmentResult, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate entryId
    if (!input.entryId || input.entryId.trim().length === 0) {
      return err(validationError("entryId cannot be empty"));
    }

    // Validate filename
    const filenameResult = Filename.create(input.filename);
    if (filenameResult.isErr()) {
      return err(validationError(filenameResult.error));
    }

    // Validate mimeType
    const mimeTypeResult = MimeType.create(input.mimeType);
    if (mimeTypeResult.isErr()) {
      return err(validationError(mimeTypeResult.error));
    }

    // Validate sizeBytes (must be > 0)
    if (!input.sizeBytes || input.sizeBytes <= 0) {
      return err(validationError("sizeBytes must be greater than 0"));
    }
    const sizeBytesResult = Bytes.create(input.sizeBytes);
    if (sizeBytesResult.isErr()) {
      return err(validationError(sizeBytesResult.error));
    }

    // Validate kind
    const kindResult = AttachmentKind.create(input.kind);
    if (kindResult.isErr()) {
      return err(validationError(kindResult.error));
    }

    const userId = input.userId.trim();
    const entryId = input.entryId.trim();
    const sizeBytes = sizeBytesResult.value;

    // Verify entry exists and belongs to user
    const entry = await this.entryRepository.findById(entryId);
    if (!entry || entry.userId !== userId) {
      return err(notFoundError("Entry not found"));
    }

    // Check entry quota (sum of active attachments + new file)
    const currentEntryBytes = await this.attachmentRepository.sumActiveBytesByEntry(entryId);
    const newEntryTotal = Bytes.fromNumber(currentEntryBytes + sizeBytes.toNumber());
    
    if (newEntryTotal.greaterThan(this.config.maxEntryAttachmentSizeBytes)) {
      return err(
        quotaExceededError(
          `Entry attachment quota exceeded. Max: ${this.config.maxEntryAttachmentSizeBytes.toHumanReadable()}, ` +
          `Current: ${Bytes.fromNumber(currentEntryBytes).toHumanReadable()}, ` +
          `New file: ${sizeBytes.toHumanReadable()}`
        )
      );
    }

    // Check user quota (sum of all active attachments + new file)
    const currentUserBytes = await this.attachmentRepository.sumActiveBytesByUser(userId);
    const newUserTotal = Bytes.fromNumber(currentUserBytes + sizeBytes.toNumber());
    
    if (newUserTotal.greaterThan(this.config.maxUserStorageQuotaBytes)) {
      return err(
        quotaExceededError(
          `User storage quota exceeded. Max: ${this.config.maxUserStorageQuotaBytes.toHumanReadable()}, ` +
          `Current: ${Bytes.fromNumber(currentUserBytes).toHumanReadable()}, ` +
          `New file: ${sizeBytes.toHumanReadable()}`
        )
      );
    }

    // Generate storage key
    const storageKey = StorageKey.generate(userId, filenameResult.value.toString());

    // Create attachment entity
    const now = new Date();
    const attachmentResult = Attachment.create({
      id: generateId(),
      userId,
      entryId,
      storageKey: storageKey.toString(),
      filename: filenameResult.value.toString(),
      mimeType: mimeTypeResult.value.toString(),
      sizeBytes: sizeBytes.toNumber(),
      kind: input.kind,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    if (attachmentResult.isErr()) {
      return err(validationError(attachmentResult.error));
    }

    const attachment = attachmentResult.value;

    // Save to repository
    await this.attachmentRepository.save(attachment);

    // Get presigned PUT URL
    const presignedPutUrl = await this.objectStorage.getPresignedPutUrl(
      storageKey.toString(),
      mimeTypeResult.value.toString(),
      sizeBytes.toNumber()
    );

    // Return result
    const json = attachment.toJSON();
    return ok({
      attachment: {
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
      },
      presignedPutUrl,
    });
  }
}
