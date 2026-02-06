import type { Attachment } from "@/domain/entities/Attachment";
import type { AttachmentRepository } from "../ports/AttachmentRepository";

/**
 * In-memory implementation of AttachmentRepository for testing.
 */
export class InMemoryAttachmentRepository implements AttachmentRepository {
  private attachments: Attachment[] = [];

  async findById(attachmentId: string): Promise<Attachment | null> {
    return this.attachments.find((a) => a.id === attachmentId) ?? null;
  }

  async save(attachment: Attachment): Promise<void> {
    this.attachments.push(attachment);
  }

  async update(attachment: Attachment): Promise<void> {
    const index = this.attachments.findIndex((a) => a.id === attachment.id);
    if (index !== -1) {
      this.attachments[index] = attachment;
    }
  }

  async sumActiveBytesByEntry(entryId: string): Promise<number> {
    return this.attachments
      .filter((a) => a.entryId === entryId && a.isActive())
      .reduce((sum, a) => sum + a.sizeBytes.toNumber(), 0);
  }

  async sumActiveBytesByUser(userId: string): Promise<number> {
    return this.attachments
      .filter((a) => a.userId === userId && a.isActive())
      .reduce((sum, a) => sum + a.sizeBytes.toNumber(), 0);
  }

  /**
   * Helper for tests: clear all attachments.
   */
  clear(): void {
    this.attachments = [];
  }

  /**
   * Helper for tests: get all attachments.
   */
  getAll(): Attachment[] {
    return [...this.attachments];
  }
}
