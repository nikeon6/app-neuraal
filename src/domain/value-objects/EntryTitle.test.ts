import { describe, it, expect } from "vitest";
import { EntryTitle } from "./EntryTitle";

describe("EntryTitle", () => {
  describe("create", () => {
    it("should create a valid title", () => {
      const result = EntryTitle.create("My Task");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("My Task");
      }
    });

    it("should allow empty title (optional field)", () => {
      const result = EntryTitle.create("");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("");
      }
    });

    it("should trim whitespace", () => {
      const result = EntryTitle.create("  My Task  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("My Task");
      }
    });

    it("should allow whitespace-only as empty", () => {
      const result = EntryTitle.create("   ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("");
      }
    });

    it("should allow title up to 120 characters", () => {
      const longTitle = "a".repeat(120);
      const result = EntryTitle.create(longTitle);
      expect(result.isOk()).toBe(true);
    });

    it("should reject title longer than 120 characters", () => {
      const tooLong = "a".repeat(121);
      const result = EntryTitle.create(tooLong);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("120");
      }
    });

    it("should allow special characters", () => {
      const result = EntryTitle.create("Task: Buy groceries! @store #priority");
      expect(result.isOk()).toBe(true);
    });

    it("should allow emojis", () => {
      const result = EntryTitle.create("📝 Important meeting");
      expect(result.isOk()).toBe(true);
    });

    it("should allow unicode characters", () => {
      const result = EntryTitle.create("Tarea: revisar código");
      expect(result.isOk()).toBe(true);
    });
  });

  describe("equals", () => {
    it("should return true for same title", () => {
      const title1 = EntryTitle.create("My Task");
      const title2 = EntryTitle.create("My Task");

      expect(title1.isOk() && title2.isOk()).toBe(true);
      if (title1.isOk() && title2.isOk()) {
        expect(title1.value.equals(title2.value)).toBe(true);
      }
    });

    it("should return false for different titles", () => {
      const title1 = EntryTitle.create("My Task");
      const title2 = EntryTitle.create("Other Task");

      expect(title1.isOk() && title2.isOk()).toBe(true);
      if (title1.isOk() && title2.isOk()) {
        expect(title1.value.equals(title2.value)).toBe(false);
      }
    });

    it("should be case-sensitive", () => {
      const title1 = EntryTitle.create("My Task");
      const title2 = EntryTitle.create("my task");

      expect(title1.isOk() && title2.isOk()).toBe(true);
      if (title1.isOk() && title2.isOk()) {
        expect(title1.value.equals(title2.value)).toBe(false);
      }
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty title", () => {
      const result = EntryTitle.create("");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isEmpty()).toBe(true);
      }
    });

    it("should return false for non-empty title", () => {
      const result = EntryTitle.create("My Task");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isEmpty()).toBe(false);
      }
    });
  });
});
