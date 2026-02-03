import { describe, it, expect } from "vitest";
import { TopicName } from "./TopicName";

describe("TopicName", () => {
  describe("create", () => {
    it("should create a valid TopicName", () => {
      const result = TopicName.create("Work");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("Work");
      }
    });

    it("should trim whitespace from name", () => {
      const result = TopicName.create("  Health  ");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("Health");
      }
    });

    it("should reject empty string", () => {
      const result = TopicName.create("");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("cannot be empty");
      }
    });

    it("should reject whitespace-only string", () => {
      const result = TopicName.create("   ");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("cannot be empty");
      }
    });

    it("should reject name that is too short (less than 2 chars)", () => {
      const result = TopicName.create("A");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("at least 2 characters");
      }
    });

    it("should accept name with exactly 2 characters", () => {
      const result = TopicName.create("AB");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("AB");
      }
    });

    it("should reject name that is too long (more than 50 chars)", () => {
      const longName = "A".repeat(51);
      const result = TopicName.create(longName);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("50 characters");
      }
    });

    it("should accept name with exactly 50 characters", () => {
      const maxName = "A".repeat(50);
      const result = TopicName.create(maxName);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(maxName);
      }
    });

    it("should preserve special characters", () => {
      const result = TopicName.create("Work & Life");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("Work & Life");
      }
    });

    it("should preserve unicode characters", () => {
      const result = TopicName.create("Trabajo 日本語");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("Trabajo 日本語");
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal names", () => {
      const name1 = TopicName.create("Work");
      const name2 = TopicName.create("Work");

      expect(name1.isOk() && name2.isOk()).toBe(true);
      if (name1.isOk() && name2.isOk()) {
        expect(name1.value.equals(name2.value)).toBe(true);
      }
    });

    it("should return false for different names", () => {
      const name1 = TopicName.create("Work");
      const name2 = TopicName.create("Health");

      expect(name1.isOk() && name2.isOk()).toBe(true);
      if (name1.isOk() && name2.isOk()) {
        expect(name1.value.equals(name2.value)).toBe(false);
      }
    });

    it("should be case-sensitive for equality", () => {
      const name1 = TopicName.create("Work");
      const name2 = TopicName.create("work");

      expect(name1.isOk() && name2.isOk()).toBe(true);
      if (name1.isOk() && name2.isOk()) {
        expect(name1.value.equals(name2.value)).toBe(false);
      }
    });
  });

  describe("equalsIgnoreCase", () => {
    it("should return true for same name with different case", () => {
      const name1 = TopicName.create("Work");
      const name2 = TopicName.create("WORK");

      expect(name1.isOk() && name2.isOk()).toBe(true);
      if (name1.isOk() && name2.isOk()) {
        expect(name1.value.equalsIgnoreCase(name2.value)).toBe(true);
      }
    });

    it("should return false for different names", () => {
      const name1 = TopicName.create("Work");
      const name2 = TopicName.create("Health");

      expect(name1.isOk() && name2.isOk()).toBe(true);
      if (name1.isOk() && name2.isOk()) {
        expect(name1.value.equalsIgnoreCase(name2.value)).toBe(false);
      }
    });
  });
});
