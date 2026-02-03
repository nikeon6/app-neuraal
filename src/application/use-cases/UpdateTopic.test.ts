import { describe, it, expect, beforeEach } from "vitest";
import { UpdateTopic } from "./UpdateTopic";
import { CreateTopic } from "./CreateTopic";
import { InMemoryTopicRepository } from "../test/InMemoryTopicRepository";

describe("UpdateTopic", () => {
  let repository: InMemoryTopicRepository;
  let updateTopic: UpdateTopic;
  let createTopic: CreateTopic;

  beforeEach(async () => {
    repository = new InMemoryTopicRepository();
    updateTopic = new UpdateTopic(repository);
    createTopic = new CreateTopic(repository);
  });

  // Helper to create a topic
  async function createTestTopic(userId: string, name: string, color: string) {
    const result = await createTopic.execute({ userId, name, color });
    if (result.isErr()) throw new Error("Failed to create test topic");
    return result.value;
  }

  describe("successful updates", () => {
    it("should update topic name", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "Work Updated",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Work Updated");
        expect(result.value.color).toBe("#3b82f6"); // unchanged
      }
    });

    it("should update topic color", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        color: "#ef4444",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Work"); // unchanged
        expect(result.value.color).toBe("#ef4444");
      }
    });

    it("should update both name and color", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "Personal",
        color: "#22c55e",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Personal");
        expect(result.value.color).toBe("#22c55e");
      }
    });

    it("should trim name on update", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "  Updated  ",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Updated");
      }
    });

    it("should normalize color to lowercase", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        color: "#AABBCC",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.color).toBe("#aabbcc");
      }
    });

    it("should persist updated topic", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "Updated",
      });

      const found = await repository.findById(topic.id);
      expect(found).not.toBeNull();
      expect(found?.name.toString()).toBe("Updated");
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when topic does not exist", async () => {
      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: "non-existent-id",
        name: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when topic belongs to another user", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      // Different user tries to update
      const result = await updateTopic.execute({
        userId: "user-456",
        topicId: topic.id,
        name: "Hacked",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Return NOT_FOUND to not leak existence info
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty name", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace-only name", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "   ",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid color format", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        color: "invalid",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject short hex color (#RGB)", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        color: "#fff",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject empty userId", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "",
        topicId: topic.id,
        name: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty topicId", async () => {
      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: "",
        name: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject when no fields to update", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("at least one field");
      }
    });
  });

  describe("duplicate detection", () => {
    it("should reject update if new name already exists for user", async () => {
      await createTestTopic("user-123", "Work", "#3b82f6");
      const topic2 = await createTestTopic("user-123", "Health", "#22c55e");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic2.id,
        name: "Work", // Already exists
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("DUPLICATE_ERROR");
      }
    });

    it("should reject duplicate with different case", async () => {
      await createTestTopic("user-123", "Work", "#3b82f6");
      const topic2 = await createTestTopic("user-123", "Health", "#22c55e");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic2.id,
        name: "WORK",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("DUPLICATE_ERROR");
      }
    });

    it("should allow updating to same name (no-op)", async () => {
      const topic = await createTestTopic("user-123", "Work", "#3b82f6");

      const result = await updateTopic.execute({
        userId: "user-123",
        topicId: topic.id,
        name: "Work", // Same name
      });

      expect(result.isOk()).toBe(true);
    });

    it("should allow name that exists for different user", async () => {
      await createTestTopic("user-123", "Work", "#3b82f6");
      const topic2 = await createTestTopic("user-456", "Health", "#22c55e");

      const result = await updateTopic.execute({
        userId: "user-456",
        topicId: topic2.id,
        name: "Work", // Exists for user-123, but not for user-456
      });

      expect(result.isOk()).toBe(true);
    });
  });
});
