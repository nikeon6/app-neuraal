import { Result, ok, err } from "@/domain/core/Result";
import type { TopicRepository } from "../../ports/TopicRepository";
import type { TopicDTO } from "../../dto/TopicDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

/**
 * Input for ListTopics use case.
 */
export interface ListTopicsInput {
  userId: string;
}

/**
 * ListTopics use case.
 * Returns all topics for a given user.
 */
export class ListTopics {
  constructor(private readonly topicRepository: TopicRepository) {}

  async execute(input: ListTopicsInput): Promise<Result<TopicDTO[], UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    const userId = input.userId.trim();

    // Fetch topics from repository
    const topics = await this.topicRepository.findByUserId(userId);

    // Map to DTOs
    const topicDTOs: TopicDTO[] = topics.map((topic) => ({
      id: topic.id,
      userId: topic.userId,
      name: topic.name.toString(),
      color: topic.color.toString(),
      createdAt: topic.createdAt.toISOString(),
    }));

    return ok(topicDTOs);
  }
}
