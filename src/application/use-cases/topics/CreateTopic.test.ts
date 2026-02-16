import { describe, it, expect, beforeEach } from "vitest";
import { CreateTopic, MAX_TOPICS_PER_USER } from "./CreateTopic";
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

  it("should reject duplicate color for same user", async () => {
    // Create first topic with blue color
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    // Try to create another topic with the same color
    const result = await createTopic.execute({
      userId: "user-123",
      name: "Health",
      color: "#3b82f6",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
      expect(result.error.message).toContain("Color");
    }
  });

  it("should reject duplicate color case-insensitively", async () => {
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#aabbcc",
    });

    const result = await createTopic.execute({
      userId: "user-123",
      name: "Health",
      color: "#AABBCC",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
    }
  });

  it("should allow same color for different users", async () => {
    const result1 = await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    const result2 = await createTopic.execute({
      userId: "user-456",
      name: "Health",
      color: "#3b82f6",
    });

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);
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

  it(`should reject creation when user already has ${MAX_TOPICS_PER_USER} topics`, async () => {
    // Create MAX topics
    const colors = [
      "#3b82f6",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#6366f1",
      "#84cc16",
      "#06b6d4",
      "#d946ef",
    ];

    for (let i = 0; i < MAX_TOPICS_PER_USER; i++) {
      const r = await createTopic.execute({
        userId: "user-123",
        name: `Topic ${i + 1}`,
        color: colors[i],
      });
      expect(r.isOk()).toBe(true);
    }

    // Try to create one more
    const result = await createTopic.execute({
      userId: "user-123",
      name: "One Too Many",
      color: "#000000",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("QUOTA_EXCEEDED");
      expect(result.error.message).toContain(`${MAX_TOPICS_PER_USER}`);
    }
  });

  it("should allow topic creation for a different user even if first user is at limit", async () => {
    const colors = [
      "#3b82f6",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#6366f1",
      "#84cc16",
      "#06b6d4",
      "#d946ef",
    ];

    for (let i = 0; i < MAX_TOPICS_PER_USER; i++) {
      await createTopic.execute({
        userId: "user-123",
        name: `Topic ${i + 1}`,
        color: colors[i],
      });
    }

    // Different user should still be able to create
    const result = await createTopic.execute({
      userId: "user-456",
      name: "Work",
      color: "#3b82f6",
    });

    expect(result.isOk()).toBe(true);
  });
});
