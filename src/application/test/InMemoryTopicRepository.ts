import type { Topic } from "@/domain/entities/Topic";
import type {
  TopicRepository,
  TopicSimilarityMatch,
} from "../ports/TopicRepository";

/**
 * Embedding data stored alongside topics in tests.
 */
interface TopicEmbeddingData {
  vector: number[];
  model: string;
  updatedAt: Date;
}

/**
 * In-memory implementation of TopicRepository for testing.
 * Does not depend on Prisma or any external service.
 */
export class InMemoryTopicRepository implements TopicRepository {
  private topics: Topic[] = [];
  private embeddings: Map<string, TopicEmbeddingData> = new Map();

  async findById(topicId: string): Promise<Topic | null> {
    return this.topics.find((t) => t.id === topicId) ?? null;
  }

  async findByUserId(userId: string): Promise<Topic[]> {
    return this.topics.filter((t) => t.userId === userId);
  }

  async findByUserIdAndName(
    userId: string,
    name: string
  ): Promise<Topic | null> {
    const normalizedName = name.trim().toLowerCase();
    return (
      this.topics.find(
        (t) =>
          t.userId === userId &&
          t.name.toString().toLowerCase() === normalizedName
      ) ?? null
    );
  }

  async findByUserIdAndColor(
    userId: string,
    color: string
  ): Promise<Topic | null> {
    const normalizedColor = color.trim().toLowerCase();
    return (
      this.topics.find(
        (t) =>
          t.userId === userId &&
          t.color.toString().toLowerCase() === normalizedColor
      ) ?? null
    );
  }

  async save(topic: Topic): Promise<void> {
    this.topics.push(topic);
  }

  async update(topic: Topic): Promise<void> {
    const index = this.topics.findIndex((t) => t.id === topic.id);
    if (index !== -1) {
      this.topics[index] = topic;
    }
  }

  async delete(topicId: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== topicId);
    this.embeddings.delete(topicId);
  }

  // =========================================================================
  // Embedding methods (Slice 6)
  // =========================================================================

  async setEmbedding(
    topicId: string,
    vector: number[],
    model: string,
    updatedAt: Date
  ): Promise<void> {
    this.embeddings.set(topicId, { vector, model, updatedAt });
  }

  async findBestMatchByEmbedding(
    userId: string,
    vector: number[]
  ): Promise<TopicSimilarityMatch | null> {
    const userTopics = this.topics.filter((t) => t.userId === userId);

    let bestMatch: TopicSimilarityMatch | null = null;

    for (const topic of userTopics) {
      const embData = this.embeddings.get(topic.id);
      if (!embData) continue;

      const distance = this.cosineDistance(vector, embData.vector);

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { topicId: topic.id, distance };
      }
    }

    return bestMatch;
  }

  /**
   * Simple cosine distance for in-memory testing.
   */
  private cosineDistance(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const mag = Math.sqrt(normA) * Math.sqrt(normB);
    if (mag === 0) return 1;
    return 1 - dot / mag;
  }

  // =========================================================================
  // Test helpers
  // =========================================================================

  /**
   * Helper for tests: clear all topics.
   */
  clear(): void {
    this.topics = [];
    this.embeddings.clear();
  }

  /**
   * Helper for tests: get all topics.
   */
  getAll(): Topic[] {
    return [...this.topics];
  }

  /**
   * Helper for tests: get embedding data for a topic.
   */
  getEmbedding(topicId: string): TopicEmbeddingData | undefined {
    return this.embeddings.get(topicId);
  }
}
