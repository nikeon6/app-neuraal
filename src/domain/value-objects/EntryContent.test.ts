import { describe, it, expect } from "vitest";
import { EntryContent } from "./EntryContent";

describe("EntryContent", () => {
  describe("create", () => {
    it("should create content from a valid object", () => {
      const result = EntryContent.create({ text: "Hello", blocks: [] });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toJSON()).toEqual({ text: "Hello", blocks: [] });
      }
    });

    it("should accept empty object", () => {
      const result = EntryContent.create({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toJSON()).toEqual({});
      }
    });

    it("should accept nested objects", () => {
      const content = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        ],
      };
      const result = EntryContent.create(content);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toJSON()).toEqual(content);
      }
    });

    it("should accept arrays in object", () => {
      const content = { items: [1, 2, 3], tags: ["a", "b"] };
      const result = EntryContent.create(content);
      expect(result.isOk()).toBe(true);
    });

    it("should reject null", () => {
      const result = EntryContent.create(
        null as unknown as Record<string, unknown>,
      );
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("object");
      }
    });

    it("should reject undefined", () => {
      const result = EntryContent.create(
        undefined as unknown as Record<string, unknown>,
      );
      expect(result.isErr()).toBe(true);
    });

    it("should reject string", () => {
      const result = EntryContent.create(
        "hello" as unknown as Record<string, unknown>,
      );
      expect(result.isErr()).toBe(true);
    });

    it("should reject number", () => {
      const result = EntryContent.create(
        123 as unknown as Record<string, unknown>,
      );
      expect(result.isErr()).toBe(true);
    });

    it("should reject array (not object)", () => {
      const result = EntryContent.create([1, 2, 3] as unknown as Record<
        string,
        unknown
      >);
      expect(result.isErr()).toBe(true);
    });

    it("should reject boolean", () => {
      const result = EntryContent.create(
        true as unknown as Record<string, unknown>,
      );
      expect(result.isErr()).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("should return a copy of the content", () => {
      const original = { text: "Hello" };
      const result = EntryContent.create(original);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json).toEqual(original);
        // Should be a copy, not the same reference
        expect(json).not.toBe(original);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equivalent content", () => {
      const content1 = EntryContent.create({ text: "Hello" });
      const content2 = EntryContent.create({ text: "Hello" });

      expect(content1.isOk() && content2.isOk()).toBe(true);
      if (content1.isOk() && content2.isOk()) {
        expect(content1.value.equals(content2.value)).toBe(true);
      }
    });

    it("should return false for different content", () => {
      const content1 = EntryContent.create({ text: "Hello" });
      const content2 = EntryContent.create({ text: "World" });

      expect(content1.isOk() && content2.isOk()).toBe(true);
      if (content1.isOk() && content2.isOk()) {
        expect(content1.value.equals(content2.value)).toBe(false);
      }
    });

    it("should compare nested structures", () => {
      const content1 = EntryContent.create({ a: { b: 1 } });
      const content2 = EntryContent.create({ a: { b: 1 } });
      const content3 = EntryContent.create({ a: { b: 2 } });

      expect(content1.isOk() && content2.isOk() && content3.isOk()).toBe(true);
      if (content1.isOk() && content2.isOk() && content3.isOk()) {
        expect(content1.value.equals(content2.value)).toBe(true);
        expect(content1.value.equals(content3.value)).toBe(false);
      }
    });
  });
});
