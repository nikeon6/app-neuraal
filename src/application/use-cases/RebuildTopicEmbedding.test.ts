import { describe, it, expect, beforeEach } from "vitest";
import { RebuildTopicEmbedding } from "./RebuildTopicEmbedding";
import { InMemoryTopicRepository } from "../test/InMemoryTopicRepository";
import { FakeEmbeddingProvider } from "../test/FakeEmbeddingProvider";
import { Topic } from "@/domain/entities/Topic";

describe("RebuildTopicEmbedding", () => {
  let topicRepo: InMemoryTopicRepository;
  let embeddingProvider: FakeEmbeddingProvider;
  let useCase: RebuildTopicEmbedding;

  const userId = "user-1";
  const topicId = "topic-1";

  beforeEach(async () => {
    topicRepo = new InMemoryTopicRepository();
    embeddingProvider = new FakeEmbeddingProvider(768);
    useCase = new RebuildTopicEmbedding(topicRepo, embeddingProvider, {
      embeddingDim: 768,
      embeddingModel: "nomic-embed-text-v2-moe:latest",
    });

    // Seed a topic
    const topic = Topic.create({
      id: topicId,
      userId,
      name: "Work",
      color: "#e11d48",
      createdAt: new Date(),
    }).unwrap();
    await topicRepo.save(topic);
  });

  it("should generate and store embedding for a topic", async () => {
    const result = await useCase.execute({ userId, topicId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.topicId).toBe(topicId);
      expect(result.value.embeddingUpdatedAt).toBeDefined();
    }

    // Verify embedding was stored
    const embData = topicRepo.getEmbedding(topicId);
    expect(embData).toBeDefined();
    expect(embData!.vector).toHaveLength(768);
    expect(embData!.model).toBe("nomic-embed-text-v2-moe:latest");
  });

  it("should call embedding provider with topic name", async () => {
    await useCase.execute({ userId, topicId });

    expect(embeddingProvider.calls).toHaveLength(1);
    expect(embeddingProvider.calls[0]).toBe("Work");
  });

  it("should return NOT_FOUND if topic does not exist", async () => {
    const result = await useCase.execute({
      userId,
      topicId: "nonexistent",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should return NOT_FOUND if topic belongs to another user", async () => {
    const result = await useCase.execute({
      userId: "other-user",
      topicId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should return INTERNAL_ERROR if embedding provider fails", async () => {
    embeddingProvider.shouldFail = new Error("Ollama down");

    const result = await useCase.execute({ userId, topicId });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("Ollama down");
    }
  });

  it("should overwrite existing embedding on rebuild", async () => {
    // First build
    await useCase.execute({ userId, topicId });
    const first = topicRepo.getEmbedding(topicId);

    // Second build (should overwrite)
    await useCase.execute({ userId, topicId });
    const second = topicRepo.getEmbedding(topicId);

    expect(second).toBeDefined();
    expect(second!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      first!.updatedAt.getTime()
    );
  });
});
