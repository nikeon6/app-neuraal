import { Entry } from "@/domain/entities/Entry";
import type { EntryRepository } from "@/application/ports/EntryRepository";
import type { SummaryFormat } from "@/domain/value-objects/SummaryText";
import { prisma } from "./prisma";

/**
 * Prisma implementation of EntryRepository.
 * Handles persistence of Entry entities to PostgreSQL.
 */
export class PrismaEntryRepository implements EntryRepository {
  async findById(entryId: string): Promise<Entry | null> {
    const record = await prisma.entry.findUnique({
      where: { id: entryId },
    });

    if (!record) {
      return null;
    }

    const result = Entry.create({
      id: record.id,
      userId: record.userId,
      date: record.date,
      type: record.type as "task" | "note",
      title: record.title,
      content: record.content as Record<string, unknown>,
      topicId: record.topicId,
      completed: record.completed,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async findByUserAndDate(userId: string, date: string): Promise<Entry[]> {
    const records = await prisma.entry.findMany({
      where: { userId, date },
      orderBy: { createdAt: "desc" },
    });

    return records
      .map((record) => {
        const result = Entry.create({
          id: record.id,
          userId: record.userId,
          date: record.date,
          type: record.type as "task" | "note",
          title: record.title,
          content: record.content as Record<string, unknown>,
          topicId: record.topicId,
          completed: record.completed,
          version: record.version,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
        return result.isOk() ? result.value : null;
      })
      .filter((entry): entry is Entry => entry !== null);
  }

  async save(entry: Entry): Promise<void> {
    await prisma.entry.create({
      data: {
        id: entry.id,
        userId: entry.userId,
        date: entry.date.toString(),
        type: entry.type.toString(),
        title: entry.title.toString(),
        content: entry.content.toJSON(),
        topicId: entry.topicId,
        completed: entry.completed,
        version: entry.version,
        createdAt: entry.createdAt,
      },
    });
  }

  async update(entry: Entry): Promise<void> {
    await prisma.entry.update({
      where: { id: entry.id },
      data: {
        title: entry.title.toString(),
        content: entry.content.toJSON(),
        topicId: entry.topicId,
        completed: entry.completed,
        version: entry.version,
      },
    });
  }

  async delete(entryId: string): Promise<void> {
    await prisma.entry.delete({
      where: { id: entryId },
    });
  }

  async updateSummary(
    entryId: string,
    summary: string,
    format: SummaryFormat
  ): Promise<void> {
    await prisma.entry.update({
      where: { id: entryId },
      data: {
        summary,
        summaryFormat: format,
        summaryUpdatedAt: new Date(),
      },
    });
  }
}
