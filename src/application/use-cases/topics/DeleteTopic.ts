import { Result, ok, err } from "@/domain/core/Result";
import type { TopicRepository } from "../../ports/TopicRepository";
import type { EntryRepository } from "../../ports/EntryRepository";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for DeleteTopic use case.
 */
export interface DeleteTopicInput {
  userId: string;
  topicId: string;
}

/**
 * DeleteTopic use case.
 * Deletes an existing topic owned by the user.
 * Returns NOT_FOUND for both non-existent and unauthorized topics (security).
 */
export class DeleteTopic {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly entryRepository: EntryRepository,
  ) {}

  async execute(input: DeleteTopicInput): Promise<Result<void, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate topicId
    if (!input.topicId || input.topicId.trim().length === 0) {
      return err(validationError("topicId cannot be empty"));
    }

    const userId = input.userId.trim();
    const topicId = input.topicId.trim();

    // Find existing topic
    const existingTopic = await this.topicRepository.findById(topicId);

    // Check existence and ownership (return NOT_FOUND for both to not leak info)
    if (existingTopic?.userId !== userId) {
      return err(notFoundError("Topic not found"));
    }

    // Reassign entries that pointed to this topic back to "No topic" (null).
    await this.entryRepository.clearTopicFromEntries(topicId);

    // Delete from repository
    await this.topicRepository.delete(topicId);

    return ok(undefined);
  }
}
