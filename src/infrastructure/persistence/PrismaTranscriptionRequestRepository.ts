import { TranscriptionRequest } from "@/domain/entities/TranscriptionRequest";
import type { TranscriptionRequestRepository } from "@/application/ports/TranscriptionRequestRepository";
import { prisma } from "./prisma";

/**
 * Prisma implementation of TranscriptionRequestRepository.
 * Handles persistence of TranscriptionRequest entities to PostgreSQL.
 */
export class PrismaTranscriptionRequestRepository implements TranscriptionRequestRepository {
  async save(request: TranscriptionRequest): Promise<void> {
    await prisma.transcriptionRequest.create({
      data: {
        id: request.id,
        userId: request.userId,
        entryId: request.entryId,
        youtubeUrl: request.youtubeUrl,
        status: request.status.toString(),
        createdAt: request.createdAt,
      },
    });
  }

  async findById(id: string): Promise<TranscriptionRequest | null> {
    const record = await prisma.transcriptionRequest.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async update(request: TranscriptionRequest): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id: request.id },
      data: {
        status: request.status.toString(),
      },
    });
  }

  async findActiveByEntryAndUrl(
    entryId: string,
    youtubeUrl: string,
  ): Promise<TranscriptionRequest | null> {
    const record = await prisma.transcriptionRequest.findFirst({
      where: {
        entryId,
        youtubeUrl,
        status: { in: ["pending", "submitted"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  private toDomain(record: {
    id: string;
    userId: string;
    entryId: string;
    youtubeUrl: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): TranscriptionRequest | null {
    const result = TranscriptionRequest.create({
      id: record.id,
      userId: record.userId,
      entryId: record.entryId,
      youtubeUrl: record.youtubeUrl,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }
}
