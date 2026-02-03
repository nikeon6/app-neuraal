import type { Attachment } from "@/domain/entities/Attachment";

/**
 * Port (interface) for Attachment persistence.
 */
export interface AttachmentRepository {
  /**
   * Finds an attachment by id.
   */
  findById(attachmentId: string): Promise<Attachment | null>;

  /**
   * Saves a new attachment (pending status).
   */
  save(attachment: Attachment): Promise<void>;

  /**
   * Updates an existing attachment.
   */
  update(attachment: Attachment): Promise<void>;

  /**
   * Sum of sizeBytes for all active attachments of an entry.
   * Active = pending or ready status.
   */
  sumActiveBytesByEntry(entryId: string): Promise<number>;

  /**
   * Sum of sizeBytes for all active attachments of a user.
   * Active = pending or ready status.
   */
  sumActiveBytesByUser(userId: string): Promise<number>;
}
