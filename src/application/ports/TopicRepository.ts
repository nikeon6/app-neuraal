import type { Topic } from "@/domain/entities/Topic";

/**
 * Port (interface) for Topic persistence.
 * Infrastructure layer will provide the concrete implementation.
 */
export interface TopicRepository {
  /**
   * Finds a topic by id.
   */
  findById(topicId: string): Promise<Topic | null>;

  /**
   * Finds all topics for a given user.
   */
  findByUserId(userId: string): Promise<Topic[]>;

  /**
   * Finds a topic by user and name (case-insensitive).
   * Used for duplicate detection.
   */
  findByUserIdAndName(userId: string, name: string): Promise<Topic | null>;

  /**
   * Saves a new topic.
   */
  save(topic: Topic): Promise<void>;

  /**
   * Updates an existing topic.
   */
  update(topic: Topic): Promise<void>;

  /**
   * Deletes a topic by id.
   */
  delete(topicId: string): Promise<void>;
}
