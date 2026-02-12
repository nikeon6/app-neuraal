import type { Topic } from "@/domain/entities/Topic";

/**
 * Result of a similarity search against topic embeddings.
 */
export interface TopicSimilarityMatch {
  topicId: string;
  distance: number; // cosine distance (0 = identical, 1 = orthogonal)
}

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
   * Used for duplicate name detection.
   */
  findByUserIdAndName(userId: string, name: string): Promise<Topic | null>;

  /**
   * Finds a topic by user and color (case-insensitive).
   * Used for duplicate color detection.
   */
  findByUserIdAndColor(userId: string, color: string): Promise<Topic | null>;

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

  // =========================================================================
  // Embedding methods (Slice 6)
  // =========================================================================

  /**
   * Stores an embedding vector for a topic.
   */
  setEmbedding(
    topicId: string,
    vector: number[],
    model: string,
    updatedAt: Date
  ): Promise<void>;

  /**
   * Finds the most similar topic for a user by comparing the given vector
   * against all topic embeddings using cosine distance.
   * Only considers topics that have an embedding set.
   * Returns null if no topics have embeddings.
   */
  findBestMatchByEmbedding(
    userId: string,
    vector: number[]
  ): Promise<TopicSimilarityMatch | null>;
}
