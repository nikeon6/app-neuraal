import { describe, it, expect } from "vitest";
import { EmbeddingModelName } from "./EmbeddingModelName";

describe("EmbeddingModelName", () => {
  describe("create", () => {
    it("should create a valid model name", () => {
      const result = EmbeddingModelName.create("nomic-embed-text-v2-moe:latest");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("nomic-embed-text-v2-moe:latest");
      }
    });

    it("should reject empty string", () => {
      const result = EmbeddingModelName.create("");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("empty");
      }
    });

    it("should reject whitespace-only string", () => {
      const result = EmbeddingModelName.create("   ");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("empty");
      }
    });

    it("should trim whitespace", () => {
      const result = EmbeddingModelName.create("  model:latest  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("model:latest");
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal names", () => {
      const a = EmbeddingModelName.create("model:v1").unwrap();
      const b = EmbeddingModelName.create("model:v1").unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it("should return false for different names", () => {
      const a = EmbeddingModelName.create("model:v1").unwrap();
      const b = EmbeddingModelName.create("model:v2").unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });
});
