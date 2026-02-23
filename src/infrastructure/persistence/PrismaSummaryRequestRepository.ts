import { EntrySummaryRequest } from "@/domain/entities/EntrySummaryRequest";
import type { SummaryRequestRepository } from "@/application/ports/SummaryRequestRepository";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

const PENDING_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SUBMITTED_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_PENDING_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SUBMITTED_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function resolveTtl(rawValue: number, fallback: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) return fallback;
  return rawValue;
}

/**
 * Prisma implementation of SummaryRequestRepository.
 * Handles persistence of EntrySummaryRequest entities to PostgreSQL.
 */
export class PrismaSummaryRequestRepository implements SummaryRequestRepository {
  private buildActiveWhere() {
    const now = Date.now();
    const pendingCutoff = new Date(
      now - resolveTtl(PENDING_ACTIVE_TTL_MS, DEFAULT_PENDING_ACTIVE_TTL_MS),
    );
    const submittedCutoff = new Date(
      now -
        resolveTtl(SUBMITTED_ACTIVE_TTL_MS, DEFAULT_SUBMITTED_ACTIVE_TTL_MS),
    );

    // Defensive TTL to avoid stale pending/submitted requests blocking users forever
    // when worker/callback failures leave requests in active states.
    return {
      OR: [
        {
          status: "pending",
          createdAt: { gte: pendingCutoff },
        },
        {
          status: "submitted",
          updatedAt: { gte: submittedCutoff },
        },
      ],
    };
  }

  async save(request: EntrySummaryRequest): Promise<void> {
    await prisma.entrySummaryRequest.create({
      data: {
        id: request.id,
        userId: request.userId,
        entryId: request.entryId,
        status: request.status.toString(),
        meta: (request.meta ?? undefined) as Prisma.InputJsonValue | undefined,
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
    userId: string,
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
        meta: (request.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findActiveByEntryId(
    entryId: string,
  ): Promise<EntrySummaryRequest | null> {
    const record = await prisma.entrySummaryRequest.findFirst({
      where: {
        entryId,
        ...this.buildActiveWhere(),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.entrySummaryRequest.count({
      where: {
        userId,
        ...this.buildActiveWhere(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    userId: string;
    entryId: string;
    status: string;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): EntrySummaryRequest | null {
    const result = EntrySummaryRequest.create({
      id: record.id,
      userId: record.userId,
      entryId: record.entryId,
      status: record.status,
      meta: (record.meta as Record<string, unknown>) ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }
}
