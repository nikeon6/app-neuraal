import { describe, it, expect, beforeEach } from "vitest";
import { DeleteTopic } from "./DeleteTopic";
import { CreateTopic } from "./CreateTopic";
import { InMemoryTopicRepository } from "../../test/InMemoryTopicRepository";

describe("DeleteTopic", () => {
  let repository: InMemoryTopicRepository;
  let deleteTopic: DeleteTopic;
  let createTopic: CreateTopic;

  beforeEach(async () => {
    repository = new InMemoryTopicRepository();
    deleteTopic = new DeleteTopic(repository);
    createTopic = new CreateTopic(repository);
  });

  // Helper to create a topic
  async function createTestTopic(userId: string, name: string, color: string) {
    const result = await createTopic.execute({ userId, name, color });
    if (result.isErr()) throw new Error("Failed to create test topic");
    return result.value;
  }

  describe("successful deletion", () => {
    it("should delete an existing topic", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await deleteTopic.execute({
        userId: "user-123",
        topicId: topic.id,
      });

      expect(result.isOk()).toBe(true);
    });

    it("should remove topic from repository", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      await deleteTopic.execute({
        userId: "user-123",
        topicId: topic.id,
      });

      const found = await repository.findById(topic.id);
      expect(found).toBeNull();
    });

    it("should only delete the specified topic", async () => {
      const topic1 = await createTestTopic("user-123", "Work", "#3b82f6");
      const topic2 = await createTestTopic("user-123", "Health", "#22c55e");

      await deleteTopic.execute({
        userId: "user-123",
        topicId: topic1.id,
      });

      const remaining = await repository.findByUserId("user-123");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(topic2.id);
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when topic does not exist", async () => {
      const result = await deleteTopic.execute({
        userId: "user-123",
        topicId: "non-existent-id",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when topic belongs to another user", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      // Different user tries to delete
      const result = await deleteTopic.execute({
        userId: "user-456",
        topicId: topic.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Return NOT_FOUND to not leak existence info
        expect(result.error.code).toBe("NOT_FOUND");
      }

      // Verify topic was not deleted
      const found = await repository.findById(topic.id);
      expect(found).not.toBeNull();
    });

    it("should not leak topic existence to unauthorized users", async () => {
      const topic = await createTestTopic(
        "user-123",
        "Secret Topic",
        "#3b82f6",
      );

      // Attacker tries to probe for topic existence
      const result = await deleteTopic.execute({
        userId: "attacker",
        topicId: topic.id,
      });

      // Should return same error as non-existent topic
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).not.toContain("Secret Topic");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await deleteTopic.execute({
        userId: "",
        topicId: topic.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace-only userId", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await deleteTopic.execute({
        userId: "   ",
        topicId: topic.id,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject empty topicId", async () => {
      const result = await deleteTopic.execute({
        userId: "user-123",
        topicId: "",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace-only topicId", async () => {
      const result = await deleteTopic.execute({
        userId: "user-123",
        topicId: "   ",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
