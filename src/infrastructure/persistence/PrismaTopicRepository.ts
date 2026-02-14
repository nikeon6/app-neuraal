import { Topic } from "@/domain/entities/Topic";
import type {
  TopicRepository,
  TopicSimilarityMatch,
} from "@/application/ports/TopicRepository";
import { Prisma } from "@/generated/prisma/client";
import { prisma, pool } from "./prisma";

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
    name: string,
  ): Promise<Topic | null> {
    const normalizedName = name.trim().toLowerCase();

    // Prisma doesn't support case-insensitive by default on all DBs,
    // so we fetch all user topics and filter in memory.
    // For large datasets, consider using raw SQL with LOWER().
    const records = await prisma.topic.findMany({
      where: { userId },
    });

    const record = records.find((r) => r.name.toLowerCase() === normalizedName);

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

  async findByUserIdAndColor(
    userId: string,
    color: string,
  ): Promise<Topic | null> {
    const normalizedColor = color.trim().toLowerCase();

    const record = await prisma.topic.findFirst({
      where: { userId, color: normalizedColor },
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

  async save(topic: Topic): Promise<void> {
    try {
      await prisma.topic.create({
        data: {
          id: topic.id,
          userId: topic.userId,
          name: topic.name.toString(),
          color: topic.color.toString(),
          createdAt: topic.createdAt,
        },
      });
    } catch (error) {
      // P2002 = unique constraint violation — convert to a readable error
      // so the API layer can return 409 instead of 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const fields = (error.meta?.target as string[]) ?? [];
        throw new Error(
          `Duplicate topic: unique constraint violated on [${fields.join(", ")}]`,
        );
      }
      throw error;
    }
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

  // =========================================================================
  // Embedding methods (Slice 6) — use raw SQL for pgvector operations
  // =========================================================================

  /**
   * Stores an embedding vector for a topic.
   * Uses raw SQL because Prisma doesn't natively support the vector type.
   */
  async setEmbedding(
    topicId: string,
    vector: number[],
    model: string,
    updatedAt: Date,
  ): Promise<void> {
    const pgVector = `[${vector.join(",")}]`;
    await pool.query(
      `UPDATE topics
         SET embedding = $1::vector,
             embedding_model = $2,
             embedding_updated_at = $3
       WHERE id = $4`,
      [pgVector, model, updatedAt, topicId],
    );
  }

  /**
   * Finds the most similar topic for a user by cosine distance.
   * Uses pgvector's <=> operator (cosine distance).
   * Only considers topics with an embedding set.
   */
  async findBestMatchByEmbedding(
    userId: string,
    vector: number[],
  ): Promise<TopicSimilarityMatch | null> {
    const pgVector = `[${vector.join(",")}]`;

    const result = await pool.query<{ id: string; distance: number }>(
      `SELECT id, (embedding <=> $1::vector) AS distance
         FROM topics
        WHERE user_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 1`,
      [pgVector, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      topicId: result.rows[0].id,
      distance: Number.parseFloat(String(result.rows[0].distance)),
    };
  }
}
