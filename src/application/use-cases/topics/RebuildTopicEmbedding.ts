import { Result, ok, err } from "@/domain/core/Result";
import type { TopicRepository } from "../../ports/TopicRepository";
import type { EmbeddingProviderPort } from "../../ports/EmbeddingProviderPort";
import type { UseCaseError } from "../../core/UseCaseError";
import { notFoundError, internalError } from "../../core/UseCaseError";

/**
 * Input for RebuildTopicEmbedding use case.
 */
export interface RebuildTopicEmbeddingInput {
  userId: string;
  topicId: string;
}

/**
 * Output of RebuildTopicEmbedding use case.
 */
export interface RebuildTopicEmbeddingOutput {
  topicId: string;
  embeddingUpdatedAt: string; // ISO date string
}

/**
 * Configuration for embedding generation.
 */
export interface EmbeddingConfig {
  embeddingDim: number;
  embeddingModel: string;
}

/**
 * RebuildTopicEmbedding use case.
 * Generates and stores an embedding vector for a topic based on its name.
 * Used when a topic is created/renamed, or for manual rebuild.
 */
export class RebuildTopicEmbedding {
  constructor(
    private readonly topicRepo: TopicRepository,
    private readonly embeddingProvider: EmbeddingProviderPort,
    private readonly config: EmbeddingConfig,
  ) {}

  async execute(
    input: RebuildTopicEmbeddingInput,
  ): Promise<Result<RebuildTopicEmbeddingOutput, UseCaseError>> {
    // 1. Find topic and verify ownership
    const topic = await this.topicRepo.findById(input.topicId);

    if (!topic || topic.userId !== input.userId) {
      return err(notFoundError("Topic not found"));
    }

    // 2. Generate embedding from topic name
    let vector: number[];
    try {
      vector = await this.embeddingProvider.embedText(topic.name.toString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown embedding error";
      return err(internalError(`Embedding generation failed: ${message}`));
    }

    // 3. Validate dimension
    if (vector.length !== this.config.embeddingDim) {
      return err(
        internalError(
          `Embedding dimension mismatch: expected ${this.config.embeddingDim}, got ${vector.length}`,
        ),
      );
    }

    // 4. Store embedding
    const now = new Date();
    await this.topicRepo.setEmbedding(
      input.topicId,
      vector,
      this.config.embeddingModel,
      now,
    );

    return ok({
      topicId: input.topicId,
      embeddingUpdatedAt: now.toISOString(),
    });
  }
}
