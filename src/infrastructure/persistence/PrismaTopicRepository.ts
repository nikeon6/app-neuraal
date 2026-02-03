import { Topic } from "@/domain/entities/Topic";
import type { TopicRepository } from "@/application/ports/TopicRepository";
import { prisma } from "./prisma";

/**
 * Prisma implementation of TopicRepository.
 * Handles persistence of Topic entities to PostgreSQL.
 */
export class PrismaTopicRepository implements TopicRepository {
  async findById(topicId: string): Promise<Topic | null> {
    const record = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!record) {
      return null;
    }

    const result = Topic.create({
      id: record.id,
      userId: record.userId,
      name: record.name,
      color: record.color,
      createdAt: record.createdAt,
    });

    return result.isOk() ? result.value : null;
  }

  async findByUserId(userId: string): Promise<Topic[]> {
    const records = await prisma.topic.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return records
      .map((record) => {
        const result = Topic.create({
          id: record.id,
          userId: record.userId,
          name: record.name,
          color: record.color,
          createdAt: record.createdAt,
        });
        return result.isOk() ? result.value : null;
      })
      .filter((topic): topic is Topic => topic !== null);
  }

  async findByUserIdAndName(
    userId: string,
    name: string
  ): Promise<Topic | null> {
    const normalizedName = name.trim().toLowerCase();

    // Prisma doesn't support case-insensitive by default on all DBs,
    // so we fetch all user topics and filter in memory.
    // For large datasets, consider using raw SQL with LOWER().
    const records = await prisma.topic.findMany({
      where: { userId },
    });

    const record = records.find(
      (r) => r.name.toLowerCase() === normalizedName
    );

    if (!record) {
      return null;
    }

    const result = Topic.create({
      id: record.id,
      userId: record.userId,
      name: record.name,
      color: record.color,
      createdAt: record.createdAt,
    });

    return result.isOk() ? result.value : null;
  }

  async save(topic: Topic): Promise<void> {
    await prisma.topic.create({
      data: {
        id: topic.id,
        userId: topic.userId,
        name: topic.name.toString(),
        color: topic.color.toString(),
        createdAt: topic.createdAt,
      },
    });
  }

  async update(topic: Topic): Promise<void> {
    await prisma.topic.update({
      where: { id: topic.id },
      data: {
        name: topic.name.toString(),
        color: topic.color.toString(),
      },
    });
  }

  async delete(topicId: string): Promise<void> {
    await prisma.topic.delete({
      where: { id: topicId },
    });
  }
}
