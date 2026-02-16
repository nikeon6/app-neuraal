import { Result, ok, err } from "@/domain/core/Result";
import { Topic } from "@/domain/entities/Topic";
import { HexColor } from "@/domain/value-objects/HexColor";
import { TopicName } from "@/domain/value-objects/TopicName";
import type { TopicRepository } from "../../ports/TopicRepository";
import type { TopicDTO } from "../../dto/TopicDTO";
import type { UseCaseError } from "../../core/UseCaseError";
import {
  validationError,
  duplicateError,
  notFoundError,
} from "../../core/UseCaseError";

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

async function resolveNewNameAndColor(
  topicRepository: TopicRepository,
  existingTopic: Topic,
  userId: string,
  nameInput: string | undefined,
  colorInput: string | undefined,
): Promise<Result<{ name: TopicName; color: HexColor }, UseCaseError>> {
  const hasNameUpdate = nameInput !== undefined;
  const hasColorUpdate = colorInput !== undefined;
  let newName = existingTopic.name;
  let newColor = existingTopic.color;

  if (hasNameUpdate) {
    const trimmedName = nameInput.trim();
    const nameResult = TopicName.create(trimmedName);
    if (nameResult.isErr()) {
      return err(validationError(nameResult.error));
    }
    if (!existingTopic.name.equalsIgnoreCase(nameResult.value)) {
      const duplicate = await topicRepository.findByUserIdAndName(
        userId,
        trimmedName,
      );
      if (duplicate) {
        return err(duplicateError(`Topic "${trimmedName}" already exists`));
      }
    }
    newName = nameResult.value;
  }

  if (hasColorUpdate && colorInput !== undefined) {
    const colorResult = HexColor.create(colorInput);
    if (colorResult.isErr()) {
      return err(validationError(colorResult.error));
    }
    newColor = colorResult.value;
  }

  return ok({ name: newName, color: newColor });
}

/**
 * UpdateTopic use case.
 * Updates an existing topic's name and/or color.
 * Validates ownership and prevents duplicate names.
 */
export class UpdateTopic {
  constructor(private readonly topicRepository: TopicRepository) {}

  async execute(
    input: UpdateTopicInput,
  ): Promise<Result<TopicDTO, UseCaseError>> {
    if (!input.userId?.trim()) {
      return err(validationError("userId cannot be empty"));
    }
    if (!input.topicId?.trim()) {
      return err(validationError("topicId cannot be empty"));
    }
    const hasNameUpdate = input.name !== undefined;
    const hasColorUpdate = input.color !== undefined;
    if (!hasNameUpdate && !hasColorUpdate) {
      return err(
        validationError(
          "Must provide at least one field to update (name or color)",
        ),
      );
    }

    const userId = input.userId.trim();
    const topicId = input.topicId.trim();
    const existingTopic = await this.topicRepository.findById(topicId);
    if (!existingTopic?.userId || existingTopic.userId !== userId) {
      return err(notFoundError("Topic not found"));
    }

    const payloadResult = await resolveNewNameAndColor(
      this.topicRepository,
      existingTopic,
      userId,
      input.name,
      input.color,
    );
    if (payloadResult.isErr()) {
      return err(payloadResult.error);
    }
    const { name: newName, color: newColor } = payloadResult.value;

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
