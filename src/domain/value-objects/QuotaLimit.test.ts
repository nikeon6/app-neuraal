import { describe, it, expect } from "vitest";
import { QuotaLimit } from "./QuotaLimit";

describe("QuotaLimit", () => {
  describe("create", () => {
    it("accepts zero", () => {
      const result = QuotaLimit.create(0);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(0);
    });

    it("accepts positive integer", () => {
      const result = QuotaLimit.create(100);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(100);
    });

    it("rejects negative", () => {
      expect(QuotaLimit.create(-1).isErr()).toBe(true);
    });
  });

  describe("isExceeded", () => {
    it("returns true when used >= limit", () => {
      const limit = QuotaLimit.fromNumber(100);
      expect(limit.isExceeded(100)).toBe(true);
      expect(limit.isExceeded(101)).toBe(true);
    });

    it("returns false when used < limit", () => {
      const limit = QuotaLimit.fromNumber(100);
      expect(limit.isExceeded(99)).toBe(false);
      expect(limit.isExceeded(0)).toBe(false);
    });
  });
});
