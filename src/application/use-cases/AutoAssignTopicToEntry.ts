import { Result, ok, err } from "@/domain/core/Result";
import { SimilarityScore } from "@/domain/value-objects/SimilarityScore";
import { extractPlainText } from "@/shared/lib/extractPlainText";
import type { TopicRepository } from "../ports/TopicRepository";
import type { EntryRepository } from "../ports/EntryRepository";
import type { EmbeddingProviderPort } from "../ports/EmbeddingProviderPort";
import type { UseCaseError } from "../core/UseCaseError";
import { notFoundError, internalError } from "../core/UseCaseError";

/**
 * Input for AutoAssignTopicToEntry use case.
 */
export interface AutoAssignTopicInput {
  userId: string;
  entryId: string;
  threshold?: number; // Override default threshold
}

/**
 * Output of AutoAssignTopicToEntry use case.
 */
export interface AutoAssignTopicOutput {
  entryId: string;
  selectedTopicId: string | null;
  score: number | null;
}

/**
 * Configuration for auto-topic assignment.
 */
export interface AutoAssignConfig {
  embeddingDim: number;
  defaultThreshold: number;
}

/**
 * AutoAssignTopicToEntry use case.
 *
 * Generates an embedding for the entry's text content, finds the most
 * similar topic by cosine distance, and assigns it if the similarity
 * score meets the threshold.
 */
export class AutoAssignTopicToEntry {
  constructor(
    private readonly topicRepo: TopicRepository,
    private readonly entryRepo: EntryRepository,
    private readonly embeddingProvider: EmbeddingProviderPort,
    private readonly config: AutoAssignConfig
  ) {}

  async execute(
    input: AutoAssignTopicInput
  ): Promise<Result<AutoAssignTopicOutput, UseCaseError>> {
    // 1. Find entry and verify ownership
    const entry = await this.entryRepo.findById(input.entryId);

    if (!entry || entry.userId !== input.userId) {
      return err(notFoundError("Entry not found"));
    }

    // 2. Build text for embedding: title + plain text from content
    const plainContent = extractPlainText(
      entry.content.toJSON() as Record<string, unknown>
    );
    const textForEmbedding = plainContent
      ? `${entry.title.toString()}\n${plainContent}`
      : entry.title.toString();

    // 3. Generate embedding
    let entryVector: number[];
    try {
      entryVector = await this.embeddingProvider.embedText(textForEmbedding);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown embedding error";
      return err(internalError(`Embedding generation failed: ${message}`));
    }

    // 4. Find best matching topic by embedding similarity
    const bestMatch = await this.topicRepo.findBestMatchByEmbedding(
      input.userId,
      entryVector
    );

    // No topics with embeddings
    if (!bestMatch) {
      return ok({
        entryId: input.entryId,
        selectedTopicId: null,
        score: null,
      });
    }

    // 5. Convert cosine distance to similarity score
    const scoreResult = SimilarityScore.fromCosineDistance(bestMatch.distance);
    if (scoreResult.isErr()) {
      return err(internalError("Failed to compute similarity score"));
    }

    const score = scoreResult.value;
    const threshold = input.threshold ?? this.config.defaultThreshold;

    // 6. Check threshold
    if (!score.meetsThreshold(threshold)) {
      return ok({
        entryId: input.entryId,
        selectedTopicId: null,
        score: score.value,
      });
    }

    // 7. Assign topic to entry
    await this.entryRepo.updateTopic(input.entryId, bestMatch.topicId);

    return ok({
      entryId: input.entryId,
      selectedTopicId: bestMatch.topicId,
      score: score.value,
    });
  }
}
