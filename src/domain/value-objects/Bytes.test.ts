import { describe, it, expect } from "vitest";
import { Bytes } from "./Bytes";

describe("Bytes", () => {
  describe("create", () => {
    it("should create valid bytes from positive number", () => {
      const result = Bytes.create(1024);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toNumber()).toBe(1024);
      }
    });

    it("should create bytes from zero", () => {
      const result = Bytes.create(0);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toNumber()).toBe(0);
      }
    });

    it("should reject negative values", () => {
      const result = Bytes.create(-1);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("negative");
      }
    });

    it("should reject NaN", () => {
      const result = Bytes.create(NaN);
      expect(result.isErr()).toBe(true);
    });

    it("should reject Infinity", () => {
      const result = Bytes.create(Infinity);
      expect(result.isErr()).toBe(true);
    });

    it("should handle large values (1GB)", () => {
      const oneGB = 1024 * 1024 * 1024;
      const result = Bytes.create(oneGB);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toNumber()).toBe(oneGB);
      }
    });

    it("should truncate decimal values", () => {
      const result = Bytes.create(1024.7);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toNumber()).toBe(1024);
      }
    });
  });

  describe("comparison", () => {
    it("should compare less than", () => {
      const small = Bytes.create(100);
      const large = Bytes.create(1000);

      expect(small.isOk() && large.isOk()).toBe(true);
      if (small.isOk() && large.isOk()) {
        expect(small.value.lessThan(large.value)).toBe(true);
        expect(large.value.lessThan(small.value)).toBe(false);
      }
    });

    it("should compare less than or equal", () => {
      const a = Bytes.create(100);
      const b = Bytes.create(100);
      const c = Bytes.create(1000);

      expect(a.isOk() && b.isOk() && c.isOk()).toBe(true);
      if (a.isOk() && b.isOk() && c.isOk()) {
        expect(a.value.lessThanOrEqual(b.value)).toBe(true);
        expect(a.value.lessThanOrEqual(c.value)).toBe(true);
        expect(c.value.lessThanOrEqual(a.value)).toBe(false);
      }
    });

    it("should compare greater than", () => {
      const small = Bytes.create(100);
      const large = Bytes.create(1000);

      expect(small.isOk() && large.isOk()).toBe(true);
      if (small.isOk() && large.isOk()) {
        expect(large.value.greaterThan(small.value)).toBe(true);
        expect(small.value.greaterThan(large.value)).toBe(false);
      }
    });
  });

  describe("arithmetic", () => {
    it("should add bytes", () => {
      const a = Bytes.create(100);
      const b = Bytes.create(200);

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        const sum = a.value.add(b.value);
        expect(sum.toNumber()).toBe(300);
      }
    });

    it("should subtract bytes", () => {
      const a = Bytes.create(300);
      const b = Bytes.create(100);

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        const diff = a.value.subtract(b.value);
        expect(diff.toNumber()).toBe(200);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal values", () => {
      const a = Bytes.create(1024);
      const b = Bytes.create(1024);

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("should return false for different values", () => {
      const a = Bytes.create(1024);
      const b = Bytes.create(2048);

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });

  describe("formatting", () => {
    it("should format as human readable", () => {
      const kb = Bytes.create(1024);
      const mb = Bytes.create(1024 * 1024);
      const gb = Bytes.create(1024 * 1024 * 1024);

      expect(kb.isOk() && mb.isOk() && gb.isOk()).toBe(true);
      if (kb.isOk() && mb.isOk() && gb.isOk()) {
        expect(kb.value.toHumanReadable()).toBe("1 KB");
        expect(mb.value.toHumanReadable()).toBe("1 MB");
        expect(gb.value.toHumanReadable()).toBe("1 GB");
      }
    });

    it("should format bytes under 1KB", () => {
      const bytes = Bytes.create(500);
      expect(bytes.isOk()).toBe(true);
      if (bytes.isOk()) {
        expect(bytes.value.toHumanReadable()).toBe("500 B");
      }
    });
  });
});
