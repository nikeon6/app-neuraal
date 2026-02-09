import { describe, it, expect, beforeEach } from "vitest";
import { AutoAssignTopicToEntry } from "./AutoAssignTopicToEntry";
import { InMemoryTopicRepository } from "../../test/InMemoryTopicRepository";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { FakeEmbeddingProvider } from "../../test/FakeEmbeddingProvider";
import { Topic } from "@/domain/entities/Topic";
import { Entry } from "@/domain/entities/Entry";

describe("AutoAssignTopicToEntry", () => {
  let topicRepo: InMemoryTopicRepository;
  let entryRepo: InMemoryEntryRepository;
  let embeddingProvider: FakeEmbeddingProvider;
  let useCase: AutoAssignTopicToEntry;

  const userId = "user-1";
  const entryId = "entry-1";
  const topicId = "topic-work";

  // Use small dim for test performance
  const DIM = 3;

  beforeEach(async () => {
    topicRepo = new InMemoryTopicRepository();
    entryRepo = new InMemoryEntryRepository();
    embeddingProvider = new FakeEmbeddingProvider(DIM);
    useCase = new AutoAssignTopicToEntry(
      topicRepo,
      entryRepo,
      embeddingProvider,
      { embeddingDim: DIM, defaultThreshold: 0.35 }
    );

    // Seed a topic with a predefined embedding
    const topic = Topic.create({
      id: topicId,
      userId,
      name: "Work",
      color: "#e11d48",
      createdAt: new Date(),
    }).unwrap();
    await topicRepo.save(topic);

    // Set a known embedding for the topic: [1, 0, 0]
    await topicRepo.setEmbedding(topicId, [1, 0, 0], "test-model", new Date());

    // Seed an entry
    const entry = Entry.create({
      id: entryId,
      userId,
      date: "2025-06-01",
      type: "task",
      title: "Finish project report",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Complete the quarterly report for work" },
            ],
          },
        ],
      },
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).unwrap();
    await entryRepo.save(entry);
  });

  it("should assign topic when score >= threshold", async () => {
    // Make the embedding provider return a vector very similar to topic [1, 0, 0]
    embeddingProvider.setResponse(
      "Finish project report\nComplete the quarterly report for work",
      [0.95, 0.05, 0.05]
    );

    const result = await useCase.execute({ userId, entryId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.selectedTopicId).toBe(topicId);
      expect(result.value.score).toBeGreaterThan(0.35);
    }

    // Verify entry was updated
    expect(entryRepo.getTopicId(entryId)).toBe(topicId);
  });

  it("should return null when score < threshold", async () => {
    // Make the embedding provider return an orthogonal vector
    embeddingProvider.setResponse(
      "Finish project report\nComplete the quarterly report for work",
      [0, 1, 0]
    );

    const result = await useCase.execute({ userId, entryId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.selectedTopicId).toBeNull();
      expect(result.value.score).toBeLessThan(0.35);
    }

    // Entry topicId should remain null
    expect(entryRepo.getTopicId(entryId)).toBeNull();
  });

  it("should return null when no topics have embeddings", async () => {
    // Clear embeddings but keep topics
    topicRepo.clear();
    const topic = Topic.create({
      id: topicId,
      userId,
      name: "Work",
      color: "#e11d48",
      createdAt: new Date(),
    }).unwrap();
    await topicRepo.save(topic);
    // No embedding set

    const result = await useCase.execute({ userId, entryId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.selectedTopicId).toBeNull();
      expect(result.value.score).toBeNull();
    }
  });

  it("should return null when user has no topics", async () => {
    topicRepo.clear(); // No topics at all

    const result = await useCase.execute({ userId, entryId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.selectedTopicId).toBeNull();
      expect(result.value.score).toBeNull();
    }
  });

  it("should return NOT_FOUND if entry does not exist", async () => {
    const result = await useCase.execute({
      userId,
      entryId: "nonexistent",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should return NOT_FOUND if entry belongs to another user", async () => {
    const result = await useCase.execute({
      userId: "other-user",
      entryId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should use custom threshold from input", async () => {
    // Set vector close but not identical to [1, 0, 0]
    // cosine similarity = 0.95 / sqrt(0.95^2 + 0.3^2 + 0.05^2) ≈ 0.95 → score ≈ 0.95
    embeddingProvider.setResponse(
      "Finish project report\nComplete the quarterly report for work",
      [0.95, 0.3, 0.05]
    );

    // With high threshold
    const result = await useCase.execute({
      userId,
      entryId,
      threshold: 0.99,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Score should be high but < 0.99
      expect(result.value.selectedTopicId).toBeNull();
    }
  });

  it("should use title only when content is empty", async () => {
    // Create entry with empty content
    const emptyEntry = Entry.create({
      id: "entry-empty",
      userId,
      date: "2025-06-01",
      type: "note",
      title: "Just a title",
      content: {},
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).unwrap();
    await entryRepo.save(emptyEntry);

    embeddingProvider.setResponse("Just a title", [0.95, 0.05, 0.05]);

    const result = await useCase.execute({
      userId,
      entryId: "entry-empty",
    });

    expect(result.isOk()).toBe(true);
    expect(embeddingProvider.calls).toContain("Just a title");
  });

  it("should return INTERNAL_ERROR if embedding provider fails", async () => {
    embeddingProvider.shouldFail = new Error("Ollama timeout");

    const result = await useCase.execute({ userId, entryId });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("should pick the best matching topic among multiple", async () => {
    // Add a second topic with its own embedding
    const topic2 = Topic.create({
      id: "topic-health",
      userId,
      name: "Health",
      color: "#3b82f6",
      createdAt: new Date(),
    }).unwrap();
    await topicRepo.save(topic2);
    await topicRepo.setEmbedding(
      "topic-health",
      [0, 1, 0],
      "test-model",
      new Date()
    );

    // Entry embedding closer to Health [0, 1, 0] than Work [1, 0, 0]
    embeddingProvider.setResponse(
      "Finish project report\nComplete the quarterly report for work",
      [0.1, 0.95, 0.05]
    );

    const result = await useCase.execute({ userId, entryId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.selectedTopicId).toBe("topic-health");
    }
  });
});
