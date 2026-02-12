import type {
  TranscriptRequestData,
  TranscriptRequestRepository,
} from "@/application/ports/TranscriptRequestRepository";
import { prisma } from "./prisma";

function toData(record: {
  id: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
  status: string;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  doneAt: Date | null;
  failedAt: Date | null;
}): TranscriptRequestData {
  return {
    id: record.id,
    userId: record.userId,
    entryId: record.entryId,
    youtubeUrl: record.youtubeUrl,
    status: record.status,
    meta: record.meta as Record<string, unknown> | null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
    doneAt: record.doneAt,
    failedAt: record.failedAt,
  };
}

export class PrismaTranscriptRequestRepository implements TranscriptRequestRepository {
  async create(
    data: Omit<TranscriptRequestData, "updatedAt" | "submittedAt" | "doneAt" | "failedAt">
  ): Promise<TranscriptRequestData> {
    const record = await prisma.transcriptionRequest.create({
      data: {
        id: data.id,
        userId: data.userId,
        entryId: data.entryId,
        youtubeUrl: data.youtubeUrl,
        status: data.status,
        meta: data.meta ?? undefined,
      },
    });
    return toData(record);
  }

  async findById(id: string): Promise<TranscriptRequestData | null> {
    const record = await prisma.transcriptionRequest.findUnique({ where: { id } });
    return record ? toData(record) : null;
  }

  async findActiveByEntryId(entryId: string): Promise<TranscriptRequestData | null> {
    const record = await prisma.transcriptionRequest.findFirst({
      where: {
        entryId,
        status: { in: ["pending", "submitted"] },
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toData(record) : null;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.transcriptionRequest.count({
      where: {
        userId,
        status: { in: ["pending", "submitted"] },
      },
    });
  }

  async markSubmitted(id: string, now: Date): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: { status: "submitted", submittedAt: now },
    });
  }

  async markDone(id: string, now: Date, meta?: Record<string, unknown>): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: {
        status: "done",
        doneAt: now,
        ...(meta && { meta }),
      },
    });
  }

  async markFailed(id: string, now: Date, meta?: Record<string, unknown>): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: {
        status: "failed",
        failedAt: now,
        ...(meta && { meta }),
      },
    });
  }
}
