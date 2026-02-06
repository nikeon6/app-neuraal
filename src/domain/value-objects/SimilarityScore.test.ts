import { describe, it, expect } from "vitest";
import { SimilarityScore } from "./SimilarityScore";

describe("SimilarityScore", () => {
  describe("create", () => {
    it("should create a valid SimilarityScore of 0", () => {
      const result = SimilarityScore.create(0);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(0);
      }
    });

    it("should create a valid SimilarityScore of 1", () => {
      const result = SimilarityScore.create(1);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(1);
      }
    });

    it("should create a valid SimilarityScore of 0.75", () => {
      const result = SimilarityScore.create(0.75);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(0.75);
      }
    });

    it("should reject negative values", () => {
      const result = SimilarityScore.create(-0.1);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("0");
      }
    });

    it("should reject values greater than 1", () => {
      const result = SimilarityScore.create(1.1);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("1");
      }
    });

    it("should reject NaN", () => {
      const result = SimilarityScore.create(NaN);
      expect(result.isErr()).toBe(true);
    });
  });

  describe("fromCosineDistance", () => {
    it("should convert distance 0 to score 1", () => {
      const score = SimilarityScore.fromCosineDistance(0);
      expect(score.isOk()).toBe(true);
      if (score.isOk()) {
        expect(score.value.value).toBe(1);
      }
    });

    it("should convert distance 1 to score 0", () => {
      const score = SimilarityScore.fromCosineDistance(1);
      expect(score.isOk()).toBe(true);
      if (score.isOk()) {
        expect(score.value.value).toBe(0);
      }
    });

    it("should convert distance 0.3 to score 0.7", () => {
      const score = SimilarityScore.fromCosineDistance(0.3);
      expect(score.isOk()).toBe(true);
      if (score.isOk()) {
        expect(score.value.value).toBeCloseTo(0.7, 5);
      }
    });

    it("should clamp distance > 1 to score 0", () => {
      const score = SimilarityScore.fromCosineDistance(1.5);
      expect(score.isOk()).toBe(true);
      if (score.isOk()) {
        expect(score.value.value).toBe(0);
      }
    });

    it("should clamp distance < 0 to score 1", () => {
      const score = SimilarityScore.fromCosineDistance(-0.1);
      expect(score.isOk()).toBe(true);
      if (score.isOk()) {
        expect(score.value.value).toBe(1);
      }
    });
  });

  describe("meetsThreshold", () => {
    it("should return true when score equals threshold", () => {
      const score = SimilarityScore.create(0.5).unwrap();
      expect(score.meetsThreshold(0.5)).toBe(true);
    });

    it("should return true when score exceeds threshold", () => {
      const score = SimilarityScore.create(0.8).unwrap();
      expect(score.meetsThreshold(0.5)).toBe(true);
    });

    it("should return false when score is below threshold", () => {
      const score = SimilarityScore.create(0.3).unwrap();
      expect(score.meetsThreshold(0.5)).toBe(false);
    });
  });
});
