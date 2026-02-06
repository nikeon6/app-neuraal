import { describe, it, expect } from "vitest";
import { Topic } from "./Topic";

describe("Topic", () => {
  describe("create", () => {
    it("should create a valid Topic with all required fields", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "Work",
        color: "#3b82f6",
        createdAt: new Date("2026-01-29T10:00:00Z"),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const topic = result.value;
        expect(topic.id).toBe("topic-123");
        expect(topic.userId).toBe("user-456");
        expect(topic.name.toString()).toBe("Work");
        expect(topic.color.toString()).toBe("#3b82f6");
        expect(topic.createdAt).toEqual(new Date("2026-01-29T10:00:00Z"));
      }
    });

    it("should reject Topic with invalid color", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "Work",
        color: "invalid-color",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("color");
      }
    });

    it("should reject Topic with empty name", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("name");
      }
    });

    it("should reject Topic with whitespace-only name", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "   ",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject Topic with name too short", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "A",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject Topic with empty id", () => {
      const result = Topic.create({
        id: "",
        userId: "user-456",
        name: "Work",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("id");
      }
    });

    it("should reject Topic with empty userId", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "",
        name: "Work",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("userId");
      }
    });

    it("should trim name before validation", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "  Work  ",
        color: "#3b82f6",
        createdAt: new Date(),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name.toString()).toBe("Work");
      }
    });

    it("should normalize color to lowercase", () => {
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "Work",
        color: "#AABBCC",
        createdAt: new Date(),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.color.toString()).toBe("#aabbcc");
      }
    });
  });

  describe("toJSON", () => {
    it("should serialize Topic to plain object", () => {
      const createdAt = new Date("2026-01-29T10:00:00Z");
      const result = Topic.create({
        id: "topic-123",
        userId: "user-456",
        name: "Work",
        color: "#3b82f6",
        createdAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json).toEqual({
          id: "topic-123",
          userId: "user-456",
          name: "Work",
          color: "#3b82f6",
          createdAt: createdAt.toISOString(),
        });
      }
    });
  });
});
