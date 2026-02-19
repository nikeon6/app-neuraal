import type {
  TranscriptRequestData,
  TranscriptRequestRepository,
} from "@/application/ports/TranscriptRequestRepository";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

const PENDING_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SUBMITTED_ACTIVE_TTL_MS = 60 * 60 * 1000; // 60 minutes

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
  private buildActiveWhere() {
    const now = Date.now();
    const pendingCutoff = new Date(now - PENDING_ACTIVE_TTL_MS);
    const submittedCutoff = new Date(now - SUBMITTED_ACTIVE_TTL_MS);

    // Defensive TTL to avoid "zombie" pending/submitted requests blocking users forever
    // when worker/callback failures leave stale states behind.
    return {
      OR: [
        {
          status: "pending",
          createdAt: { gte: pendingCutoff },
        },
        {
          status: "submitted",
          OR: [
            { submittedAt: { gte: submittedCutoff } },
            {
              AND: [
                { submittedAt: null },
                { updatedAt: { gte: submittedCutoff } },
              ],
            },
          ],
        },
      ],
    };
  }

  async create(
    data: Omit<
      TranscriptRequestData,
      "updatedAt" | "submittedAt" | "doneAt" | "failedAt"
    >,
  ): Promise<TranscriptRequestData> {
    const record = await prisma.transcriptionRequest.create({
      data: {
        id: data.id,
        userId: data.userId,
        entryId: data.entryId,
        youtubeUrl: data.youtubeUrl,
        status: data.status,
        meta: (data.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return toData(record);
  }

  async findById(id: string): Promise<TranscriptRequestData | null> {
    const record = await prisma.transcriptionRequest.findUnique({
      where: { id },
    });
    return record ? toData(record) : null;
  }

  async findActiveByEntryId(
    entryId: string,
  ): Promise<TranscriptRequestData | null> {
    const record = await prisma.transcriptionRequest.findFirst({
      where: {
        entryId,
        ...this.buildActiveWhere(),
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toData(record) : null;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.transcriptionRequest.count({
      where: {
        userId,
        ...this.buildActiveWhere(),
      },
    });
  }

  async markSubmitted(id: string, now: Date): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: { status: "submitted", submittedAt: now },
    });
  }

  async markDone(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: {
        status: "done",
        doneAt: now,
        ...(meta != null && { meta: meta as Prisma.InputJsonValue }),
      },
    });
  }

  async markFailed(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.transcriptionRequest.update({
      where: { id },
      data: {
        status: "failed",
        failedAt: now,
        ...(meta != null && { meta: meta as Prisma.InputJsonValue }),
      },
    });
  }
}
