import { describe, it, expect, beforeEach } from "vitest";
import { CreateTopic } from "./CreateTopic";
import { InMemoryTopicRepository } from "../../test/InMemoryTopicRepository";

describe("CreateTopic", () => {
  let repository: InMemoryTopicRepository;
  let createTopic: CreateTopic;

  beforeEach(() => {
    repository = new InMemoryTopicRepository();
    createTopic = new CreateTopic(repository);
  });

  it("should create a topic with valid data", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe("Work");
      expect(result.value.color).toBe("#3b82f6");
      expect(result.value.userId).toBe("user-123");
      expect(result.value.id).toBeDefined();
      expect(result.value.createdAt).toBeDefined();
    }

    // Verify it was saved
    const topics = await repository.findByUserId("user-123");
    expect(topics).toHaveLength(1);
  });

  it("should trim whitespace from name", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "  Health  ",
      color: "#22c55e",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe("Health");
    }
  });

  it("should normalize color to lowercase", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#AABBCC",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.color).toBe("#aabbcc");
    }
  });

  it("should reject empty name", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "",
      color: "#3b82f6",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("name");
    }
  });

  it("should reject whitespace-only name", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "   ",
      color: "#3b82f6",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject invalid color format", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "invalid",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("color");
    }
  });

  it("should reject color without # prefix", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "3b82f6",
    });

    expect(result.isErr()).toBe(true);
  });

  it("should reject short hex color (#RGB)", async () => {
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#fff",
    });

    expect(result.isErr()).toBe(true);
  });

  it("should reject duplicate topic name for same user (case-insensitive)", async () => {
    // Create first topic
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    // Try to create duplicate with different case
    const result = await createTopic.execute({
      userId: "user-123",
      name: "WORK",
      color: "#ef4444",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
      expect(result.error.message).toContain("already exists");
    }
  });

  it("should reject duplicate topic name with leading/trailing spaces", async () => {
    // Create first topic
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    // Try to create duplicate with spaces
    const result = await createTopic.execute({
      userId: "user-123",
      name: "  work  ",
      color: "#ef4444",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
    }
  });

  it("should allow same topic name for different users", async () => {
    // Create topic for user 1
    const result1 = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    // Create same topic name for user 2
    const result2 = await createTopic.execute({
      userId: "user-456",
      name: "Work",
      color: "#ef4444",
    });

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    const user1Topics = await repository.findByUserId("user-123");
    const user2Topics = await repository.findByUserId("user-456");
    expect(user1Topics).toHaveLength(1);
    expect(user2Topics).toHaveLength(1);
  });

  it("should reject empty userId", async () => {
    const result = await createTopic.execute({
      userId: "",
      name: "Work",
      color: "#3b82f6",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("userId");
    }
  });
});
