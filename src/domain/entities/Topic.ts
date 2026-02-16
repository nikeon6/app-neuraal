import { Result, ok, err } from "../core/Result";
import { HexColor } from "../value-objects/HexColor";
import { TopicName } from "../value-objects/TopicName";

/**
 * Input for creating a Topic entity.
 */
export interface CreateTopicInput {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
}

/**
 * Serialized Topic for DTOs/persistence.
 */
export interface TopicJSON {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

/**
 * Topic entity.
 * Represents a user's topic/category for organizing tasks.
 *
 * Invariants:
 * - Must have valid id (non-empty)
 * - Must have valid userId (non-empty)
 * - Must have valid TopicName
 * - Must have valid HexColor
 * - Must have createdAt timestamp
 */
export class Topic {
  readonly id: string;
  readonly userId: string;
  readonly name: TopicName;
  readonly color: HexColor;
  readonly createdAt: Date;

  private constructor(
    id: string,
    userId: string,
    name: TopicName,
    color: HexColor,
    createdAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.name = name;
    this.color = color;
    this.createdAt = createdAt;
  }

  /**
   * Creates a Topic entity with validation.
   */
  static create(input: CreateTopicInput): Result<Topic> {
    // Validate id
    if (!input.id || input.id.trim().length === 0) {
      return err("Topic id cannot be empty");
    }

    // Validate userId
    if (!input.userId || input.userId.trim().length === 0) {
      return err("Topic userId cannot be empty");
    }

    // Validate name
    const nameResult = TopicName.create(input.name);
    if (nameResult.isErr()) {
      return err(`Invalid topic name: ${nameResult.error}`);
    }

    // Validate color
    const colorResult = HexColor.create(input.color);
    if (colorResult.isErr()) {
      return err(`Invalid topic color: ${colorResult.error}`);
    }

    return ok(
      new Topic(
        input.id.trim(),
        input.userId.trim(),
        nameResult.value,
        colorResult.value,
        input.createdAt,
      ),
    );
  }

  /**
   * Serializes the Topic to a plain JSON object.
   */
  toJSON(): TopicJSON {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name.toString(),
      color: this.color.toString(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
