import { Attachment } from "@/domain/entities/Attachment";
import type { AttachmentRepository } from "@/application/ports/AttachmentRepository";
import { prisma } from "./prisma";

/**
 * Prisma implementation of AttachmentRepository.
 */
export class PrismaAttachmentRepository implements AttachmentRepository {
  async findById(attachmentId: string): Promise<Attachment | null> {
    const record = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!record) {
      return null;
    }

    const result = Attachment.create({
      id: record.id,
      userId: record.userId,
      entryId: record.entryId,
      storageKey: record.storageKey,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      kind: record.kind as "inline" | "file",
      status: record.status as "pending" | "ready" | "deleted",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async findByEntryId(entryId: string): Promise<Attachment[]> {
    const records = await prisma.attachment.findMany({
      where: { entryId, status: { not: "deleted" } },
      orderBy: { createdAt: "asc" },
    });

    return records
      .map((record) => {
        const result = Attachment.create({
          id: record.id,
          userId: record.userId,
          entryId: record.entryId,
          storageKey: record.storageKey,
          filename: record.filename,
          mimeType: record.mimeType,
          sizeBytes: record.sizeBytes,
          kind: record.kind as "inline" | "file",
          status: record.status as "pending" | "ready" | "deleted",
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
        return result.isOk() ? result.value : null;
      })
      .filter((a): a is Attachment => a !== null);
  }

  async save(attachment: Attachment): Promise<void> {
    const json = attachment.toJSON();
    await prisma.attachment.create({
      data: {
        id: json.id,
        userId: json.userId,
        entryId: json.entryId,
        storageKey: json.storageKey,
        filename: json.filename,
        mimeType: json.mimeType,
        sizeBytes: json.sizeBytes,
        kind: json.kind,
        status: json.status,
        createdAt: json.createdAt,
      },
    });
  }

  async update(attachment: Attachment): Promise<void> {
    const json = attachment.toJSON();
    await prisma.attachment.update({
      where: { id: json.id },
      data: {
        status: json.status,
      },
    });
  }

  async sumActiveBytesByEntry(entryId: string): Promise<number> {
    const result = await prisma.attachment.aggregate({
      where: {
        entryId,
        status: { in: ["pending", "ready"] },
      },
      _sum: {
        sizeBytes: true,
      },
    });

    return result._sum.sizeBytes ?? 0;
  }

  async sumActiveBytesByUser(userId: string): Promise<number> {
    const result = await prisma.attachment.aggregate({
      where: {
        userId,
        status: { in: ["pending", "ready"] },
      },
      _sum: {
        sizeBytes: true,
      },
    });

    return result._sum.sizeBytes ?? 0;
  }
}
