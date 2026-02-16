import { describe, it, expect } from "vitest";
import { CharCount } from "./CharCount";

describe("CharCount", () => {
  describe("create", () => {
    it("accepts zero", () => {
      const result = CharCount.create(0);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(0);
    });

    it("accepts positive integer", () => {
      const result = CharCount.create(5000);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(5000);
    });

    it("rejects negative", () => {
      expect(CharCount.create(-1).isErr()).toBe(true);
    });

    it("rejects non-finite", () => {
      expect(CharCount.create(Number.NaN).isErr()).toBe(true);
      expect(CharCount.create(Number.POSITIVE_INFINITY).isErr()).toBe(true);
    });
  });

  describe("exceedsMax", () => {
    it("returns true when value > max", () => {
      const count = CharCount.fromNumber(12001);
      expect(count.exceedsMax(12000)).toBe(true);
    });

    it("returns false when value <= max", () => {
      const count = CharCount.fromNumber(12000);
      expect(count.exceedsMax(12000)).toBe(false);
      expect(CharCount.fromNumber(0).exceedsMax(100)).toBe(false);
    });
  });
});
