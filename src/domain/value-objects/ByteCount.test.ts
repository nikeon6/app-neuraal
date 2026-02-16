import { describe, it, expect } from "vitest";
import { ByteCount } from "./ByteCount";

describe("ByteCount", () => {
  describe("create", () => {
    it("accepts zero", () => {
      const result = ByteCount.create(0);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(0);
    });

    it("accepts positive integer", () => {
      const result = ByteCount.create(4_000_000);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(4_000_000);
    });

    it("floors decimals", () => {
      const result = ByteCount.create(1.9);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.toNumber()).toBe(1);
    });

    it("rejects negative", () => {
      expect(ByteCount.create(-1).isErr()).toBe(true);
    });

    it("rejects NaN", () => {
      expect(ByteCount.create(NaN).isErr()).toBe(true);
    });

    it("rejects Infinity", () => {
      expect(ByteCount.create(Infinity).isErr()).toBe(true);
    });
  });

  describe("fromNumber", () => {
    it("clamps negative to 0", () => {
      expect(ByteCount.fromNumber(-5).toNumber()).toBe(0);
    });
  });

  describe("exceedsMax", () => {
    it("returns true when exceeding", () => {
      expect(ByteCount.fromNumber(5_000_000).exceedsMax(4_000_000)).toBe(true);
    });
    it("returns false when within limit", () => {
      expect(ByteCount.fromNumber(3_000_000).exceedsMax(4_000_000)).toBe(false);
    });
    it("returns false when equal", () => {
      expect(ByteCount.fromNumber(4_000_000).exceedsMax(4_000_000)).toBe(false);
    });
  });
});
