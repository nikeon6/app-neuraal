import { describe, it, expect } from "vitest";
import { StorageKey } from "./StorageKey";

describe("StorageKey", () => {
  describe("create", () => {
    it("should create valid storage key", () => {
      const result = StorageKey.create("user-123/entry-456/file.pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("user-123/entry-456/file.pdf");
      }
    });

    it("should accept keys with uuid format", () => {
      const result = StorageKey.create(
        "users/550e8400-e29b-41d4-a716-446655440000/attachments/abc123.pdf"
      );
      expect(result.isOk()).toBe(true);
    });

    it("should accept simple keys", () => {
      const result = StorageKey.create("file.pdf");
      expect(result.isOk()).toBe(true);
    });

    it("should reject empty string", () => {
      const result = StorageKey.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only", () => {
      const result = StorageKey.create("   ");
      expect(result.isErr()).toBe(true);
    });

    it("should trim whitespace", () => {
      const result = StorageKey.create("  path/to/file.pdf  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("path/to/file.pdf");
      }
    });

    it("should reject key too long (1024+ chars)", () => {
      const longKey = "a/".repeat(600);
      const result = StorageKey.create(longKey);
      expect(result.isErr()).toBe(true);
    });
  });

  describe("generate", () => {
    it("should generate unique key with userId and filename", () => {
      const key = StorageKey.generate("user-123", "document.pdf");
      expect(key.toString()).toContain("user-123");
      expect(key.toString()).toContain("document.pdf");
    });

    it("should generate different keys for same inputs", () => {
      const key1 = StorageKey.generate("user-123", "doc.pdf");
      const key2 = StorageKey.generate("user-123", "doc.pdf");

      // Keys should be unique due to random component
      expect(key1.toString()).not.toBe(key2.toString());
    });
  });

  describe("equals", () => {
    it("should return true for same key", () => {
      const a = StorageKey.create("path/file.pdf");
      const b = StorageKey.create("path/file.pdf");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("should return false for different keys", () => {
      const a = StorageKey.create("path/file1.pdf");
      const b = StorageKey.create("path/file2.pdf");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });
});
