import type { Topic } from "@/domain/entities/Topic";
import type { TopicRepository } from "../ports/TopicRepository";

/**
 * In-memory implementation of TopicRepository for testing.
 * Does not depend on Prisma or any external service.
 */
export class InMemoryTopicRepository implements TopicRepository {
  private topics: Topic[] = [];

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
  }

  /**
   * Helper for tests: clear all topics.
   */
  clear(): void {
    this.topics = [];
  }

  /**
   * Helper for tests: get all topics.
   */
  getAll(): Topic[] {
    return [...this.topics];
  }
}
