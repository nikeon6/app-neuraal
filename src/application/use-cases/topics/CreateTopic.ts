import { Result, ok, err } from "@/domain/core/Result";
import { Topic } from "@/domain/entities/Topic";
import type { TopicRepository } from "../../ports/TopicRepository";
import type { TopicDTO } from "../../dto/TopicDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  validationError,
  duplicateError,
  quotaExceededError,
} from "../../core/UseCaseError";

/** Maximum number of topics a user can create. */
export const MAX_TOPICS_PER_USER = 12;

/**
 * Input for CreateTopic use case.
 */
export interface CreateTopicInput {
  userId: string;
  name: string;
  color: string;
}

/**
 * CreateTopic use case.
 * Creates a new topic for a user with validation and duplicate detection.
 */
export class CreateTopic {
  constructor(private readonly topicRepository: TopicRepository) {}

  async execute(input: CreateTopicInput): Promise<Result<TopicDTO, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    const userId = input.userId.trim();
    const trimmedName = input.name.trim();

    // Check topic limit per user
    const userTopics = await this.topicRepository.findByUserId(userId);
    if (userTopics.length >= MAX_TOPICS_PER_USER) {
      return err(
        quotaExceededError(
          `Maximum number of topics (${MAX_TOPICS_PER_USER}) reached`
        )
      );
    }

    // Check for duplicate name (case-insensitive)
    const existing = await this.topicRepository.findByUserIdAndName(
      userId,
      trimmedName
    );

    if (existing) {
      return err(
        duplicateError(`Topic "${trimmedName}" already exists for this user`)
      );
    }

    // Check for duplicate color (case-insensitive)
    const existingColor = await this.topicRepository.findByUserIdAndColor(
      userId,
      input.color
    );

    if (existingColor) {
      return err(
        duplicateError(`Color "${input.color}" is already used by another topic`)
      );
    }

    // Create topic entity (validates name and color)
    const topicResult = Topic.create({
      id: this.generateId(),
      userId,
      name: input.name,
      color: input.color,
      createdAt: new Date(),
    });

    if (topicResult.isErr()) {
      return err(validationError(topicResult.error));
    }

    const topic = topicResult.value;

    // Save to repository (embedding generation is handled by the API route layer)
    await this.topicRepository.save(topic);

    // Return DTO
    return ok({
      id: topic.id,
      userId: topic.userId,
      name: topic.name.toString(),
      color: topic.color.toString(),
      createdAt: topic.createdAt.toISOString(),
    });
  }

  /**
   * Generates a unique ID for a topic.
   * Uses crypto.randomUUID if available, fallback to simple random string.
   */
  private generateId(): string {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `topic-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }
}
