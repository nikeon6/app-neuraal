import { EntrySummaryRequest } from "@/domain/entities/EntrySummaryRequest";
import type { SummaryRequestRepository } from "@/application/ports/SummaryRequestRepository";
import { prisma } from "./prisma";

/**
 * Prisma implementation of SummaryRequestRepository.
 * Handles persistence of EntrySummaryRequest entities to PostgreSQL.
 */
export class PrismaSummaryRequestRepository implements SummaryRequestRepository {
  async save(request: EntrySummaryRequest): Promise<void> {
    await prisma.entrySummaryRequest.create({
      data: {
        id: request.id,
        userId: request.userId,
        entryId: request.entryId,
        status: request.status.toString(),
        createdAt: request.createdAt,
      },
    });
  }

  async findById(id: string): Promise<EntrySummaryRequest | null> {
    const record = await prisma.entrySummaryRequest.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<EntrySummaryRequest | null> {
    const record = await prisma.entrySummaryRequest.findFirst({
      where: { id, userId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async update(request: EntrySummaryRequest): Promise<void> {
    await prisma.entrySummaryRequest.update({
      where: { id: request.id },
      data: {
        status: request.status.toString(),
      },
    });
  }

  async findActiveByEntryId(
    entryId: string
  ): Promise<EntrySummaryRequest | null> {
    const record = await prisma.entrySummaryRequest.findFirst({
      where: {
        entryId,
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
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): EntrySummaryRequest | null {
    const result = EntrySummaryRequest.create({
      id: record.id,
      userId: record.userId,
      entryId: record.entryId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }
}
