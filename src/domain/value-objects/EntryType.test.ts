import { describe, it, expect } from "vitest";
import { EntryType } from "./EntryType";

describe("EntryType", () => {
  describe("create", () => {
    it("should create 'task' type", () => {
      const result = EntryType.create("task");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("task");
        expect(result.value.isTask()).toBe(true);
        expect(result.value.isNote()).toBe(false);
      }
    });

    it("should create 'note' type", () => {
      const result = EntryType.create("note");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("note");
        expect(result.value.isTask()).toBe(false);
        expect(result.value.isNote()).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = EntryType.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid type", () => {
      const result = EntryType.create("event");
      expect(result.isErr()).toBe(true);
    });

    it("should reject uppercase 'TASK'", () => {
      const result = EntryType.create("TASK");
      expect(result.isErr()).toBe(true);
    });

    it("should reject mixed case 'Task'", () => {
      const result = EntryType.create("Task");
      expect(result.isErr()).toBe(true);
    });

    it("should reject type with spaces", () => {
      const result = EntryType.create(" task ");
      expect(result.isErr()).toBe(true);
    });

    it("should reject null-like values", () => {
      const result = EntryType.create("null");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("equals", () => {
    it("should return true for same type", () => {
      const type1 = EntryType.create("task");
      const type2 = EntryType.create("task");

      expect(type1.isOk() && type2.isOk()).toBe(true);
      if (type1.isOk() && type2.isOk()) {
        expect(type1.value.equals(type2.value)).toBe(true);
      }
    });

    it("should return false for different types", () => {
      const type1 = EntryType.create("task");
      const type2 = EntryType.create("note");

      expect(type1.isOk() && type2.isOk()).toBe(true);
      if (type1.isOk() && type2.isOk()) {
        expect(type1.value.equals(type2.value)).toBe(false);
      }
    });
  });
});
