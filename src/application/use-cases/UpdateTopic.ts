import { Result, ok, err } from "@/domain/core/Result";
import { Topic } from "@/domain/entities/Topic";
import { HexColor } from "@/domain/value-objects/HexColor";
import { TopicName } from "@/domain/value-objects/TopicName";
import type { TopicRepository } from "../ports/TopicRepository";
import type { TopicDTO } from "../dto/TopicDTO";
import type { UseCaseError } from "../core/UseCaseError";
import { validationError, duplicateError, notFoundError } from "../core/UseCaseError";

/**
 * Input for UpdateTopic use case.
 * At least one of name or color must be provided.
 */
export interface UpdateTopicInput {
  userId: string;
  topicId: string;
  name?: string;
  color?: string;
}

/**
 * UpdateTopic use case.
 * Updates an existing topic's name and/or color.
 * Validates ownership and prevents duplicate names.
 */
export class UpdateTopic {
  constructor(private readonly topicRepository: TopicRepository) {}

  async execute(input: UpdateTopicInput): Promise<Result<TopicDTO, UseCaseError>> {
    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err(validationError("userId cannot be empty"));
    }

    // Validate topicId
    if (!input.topicId || input.topicId.trim().length === 0) {
      return err(validationError("topicId cannot be empty"));
    }

    // Check that at least one field is being updated
    const hasNameUpdate = input.name !== undefined;
    const hasColorUpdate = input.color !== undefined;

    if (!hasNameUpdate && !hasColorUpdate) {
      return err(validationError("Must provide at least one field to update (name or color)"));
    }

    const userId = input.userId.trim();
    const topicId = input.topicId.trim();

    // Find existing topic
    const existingTopic = await this.topicRepository.findById(topicId);

    // Check existence and ownership (return NOT_FOUND for both to not leak info)
    if (!existingTopic || existingTopic.userId !== userId) {
      return err(notFoundError("Topic not found"));
    }

    // Validate and prepare new values
    let newName = existingTopic.name;
    let newColor = existingTopic.color;

    // Validate name if updating
    if (hasNameUpdate) {
      const trimmedName = input.name!.trim();

      // Check if name is valid
      const nameResult = TopicName.create(trimmedName);
      if (nameResult.isErr()) {
        return err(validationError(nameResult.error));
      }

      // Check for duplicates (if name is changing)
      if (!existingTopic.name.equalsIgnoreCase(nameResult.value)) {
        const duplicate = await this.topicRepository.findByUserIdAndName(
          userId,
          trimmedName
        );
        if (duplicate) {
          return err(duplicateError(`Topic "${trimmedName}" already exists`));
        }
      }

      newName = nameResult.value;
    }

    // Validate color if updating
    if (hasColorUpdate) {
      const colorResult = HexColor.create(input.color!);
      if (colorResult.isErr()) {
        return err(validationError(colorResult.error));
      }
      newColor = colorResult.value;
    }

    // Create updated topic entity
    const updatedTopicResult = Topic.create({
      id: existingTopic.id,
      userId: existingTopic.userId,
      name: newName.toString(),
      color: newColor.toString(),
      createdAt: existingTopic.createdAt,
    });

    if (updatedTopicResult.isErr()) {
      return err(validationError(updatedTopicResult.error));
    }

    const updatedTopic = updatedTopicResult.value;

    // Save to repository
    await this.topicRepository.update(updatedTopic);

    // Return DTO
    return ok({
      id: updatedTopic.id,
      userId: updatedTopic.userId,
      name: updatedTopic.name.toString(),
      color: updatedTopic.color.toString(),
      createdAt: updatedTopic.createdAt.toISOString(),
    });
  }
}
