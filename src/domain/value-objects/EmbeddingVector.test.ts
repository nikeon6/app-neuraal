import { describe, it, expect } from "vitest";
import { EmbeddingVector } from "./EmbeddingVector";

describe("EmbeddingVector", () => {
  const DIM = 4096;

  describe("create", () => {
    it("should create a valid EmbeddingVector of correct dimension", () => {
      const values = Array.from({ length: DIM }, (_, i) => i * 0.001);
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toArray()).toHaveLength(DIM);
        expect(result.value.dimension).toBe(DIM);
      }
    });

    it("should reject empty array", () => {
      const result = EmbeddingVector.create([], DIM);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("dimension");
      }
    });

    it("should reject wrong dimension", () => {
      const values = Array.from({ length: 10 }, () => 0.1);
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("4096");
      }
    });

    it("should reject NaN values", () => {
      const values = Array.from({ length: DIM }, () => 0.1);
      values[5] = NaN;
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("finite");
      }
    });

    it("should reject Infinity values", () => {
      const values = Array.from({ length: DIM }, () => 0.1);
      values[0] = Infinity;
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("finite");
      }
    });

    it("should reject -Infinity values", () => {
      const values = Array.from({ length: DIM }, () => 0.1);
      values[0] = -Infinity;
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("finite");
      }
    });
  });

  describe("toArray", () => {
    it("should return a copy of the values", () => {
      const values = Array.from({ length: DIM }, (_, i) => i * 0.001);
      const result = EmbeddingVector.create(values, DIM);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const arr = result.value.toArray();
        arr[0] = 999; // mutate copy
        expect(result.value.toArray()[0]).toBe(0); // original unchanged
      }
    });
  });

  describe("toPgVector", () => {
    it("should return a pgvector-compatible string", () => {
      const values = [0.1, 0.2, 0.3];
      const result = EmbeddingVector.create(values, 3);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toPgVector()).toBe("[0.1,0.2,0.3]");
      }
    });
  });

  describe("cosineDistance", () => {
    it("should return 0 for identical vectors", () => {
      const values = Array.from({ length: 3 }, () => 1);
      const a = EmbeddingVector.create(values, 3).unwrap();
      const b = EmbeddingVector.create(values, 3).unwrap();

      expect(a.cosineDistance(b)).toBeCloseTo(0, 5);
    });

    it("should return ~1 for orthogonal vectors", () => {
      const a = EmbeddingVector.create([1, 0, 0], 3).unwrap();
      const b = EmbeddingVector.create([0, 1, 0], 3).unwrap();

      expect(a.cosineDistance(b)).toBeCloseTo(1, 5);
    });

    it("should return ~2 for opposite vectors", () => {
      const a = EmbeddingVector.create([1, 0, 0], 3).unwrap();
      const b = EmbeddingVector.create([-1, 0, 0], 3).unwrap();

      expect(a.cosineDistance(b)).toBeCloseTo(2, 5);
    });

    it("should throw for different dimensions", () => {
      const a = EmbeddingVector.create([1, 0, 0], 3).unwrap();
      const b = EmbeddingVector.create([1, 0], 2).unwrap();

      expect(() => a.cosineDistance(b)).toThrow("dimension");
    });
  });
});
