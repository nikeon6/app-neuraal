import { describe, it, expect, beforeEach } from "vitest";
import { ListTopics } from "./ListTopics";
import { CreateTopic } from "./CreateTopic";
import { InMemoryTopicRepository } from "../test/InMemoryTopicRepository";

describe("ListTopics", () => {
  let repository: InMemoryTopicRepository;
  let listTopics: ListTopics;
  let createTopic: CreateTopic;

  beforeEach(() => {
    repository = new InMemoryTopicRepository();
    listTopics = new ListTopics(repository);
    createTopic = new CreateTopic(repository);
  });

  it("should return empty array when user has no topics", async () => {
    const result = await listTopics.execute({ userId: "user-123" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  it("should return all topics for a user", async () => {
    // Create topics
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });
    await createTopic.execute({
      userId: "user-123",
      name: "Health",
      color: "#22c55e",
    });
    await createTopic.execute({
      userId: "user-123",
      name: "Family",
      color: "#ec4899",
    });

    const result = await listTopics.execute({ userId: "user-123" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(3);
      const names = result.value.map((t) => t.name);
      expect(names).toContain("Work");
      expect(names).toContain("Health");
      expect(names).toContain("Family");
    }
  });

  it("should only return topics for the specified user", async () => {
    // Create topics for different users
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });
    await createTopic.execute({
      userId: "user-456",
      name: "Health",
      color: "#22c55e",
    });
    await createTopic.execute({
      userId: "user-123",
      name: "Family",
      color: "#ec4899",
    });

    const result = await listTopics.execute({ userId: "user-123" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
      const names = result.value.map((t) => t.name);
      expect(names).toContain("Work");
      expect(names).toContain("Family");
      expect(names).not.toContain("Health");
    }
  });

  it("should return topics with all required fields", async () => {
    await createTopic.execute({
      userId: "user-123",
      name: "Work",
      color: "#3b82f6",
    });

    const result = await listTopics.execute({ userId: "user-123" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const topic = result.value[0];
      expect(topic.id).toBeDefined();
      expect(topic.userId).toBe("user-123");
      expect(topic.name).toBe("Work");
      expect(topic.color).toBe("#3b82f6");
      expect(topic.createdAt).toBeDefined();
    }
  });

  it("should reject empty userId", async () => {
    const result = await listTopics.execute({ userId: "" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("userId");
    }
  });

  it("should reject whitespace-only userId", async () => {
    const result = await listTopics.execute({ userId: "   " });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
