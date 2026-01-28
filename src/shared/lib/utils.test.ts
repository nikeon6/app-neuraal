import { describe, it, expect } from "vitest";
import { cn, uid, clamp, median, quadPath } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("should merge tailwind classes correctly", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });
  });

  describe("uid", () => {
    it("should generate unique identifiers", () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1).not.toBe(id2);
    });

    it("should return a string", () => {
      expect(typeof uid()).toBe("string");
    });

    it("should contain a hyphen separator", () => {
      expect(uid()).toMatch(/-/);
    });
  });

  describe("clamp", () => {
    it("should return the value when within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("should return min when value is below range", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("should return max when value is above range", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("should handle edge cases at boundaries", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe("median", () => {
    it("should return 0 for empty array", () => {
      expect(median([])).toBe(0);
    });

    it("should return the single value for array with one element", () => {
      expect(median([5])).toBe(5);
    });

    it("should return middle value for odd-length array", () => {
      expect(median([1, 3, 5])).toBe(3);
    });

    it("should return average of middle values for even-length array", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("should handle unsorted arrays", () => {
      expect(median([5, 1, 3])).toBe(3);
    });
  });

  describe("quadPath", () => {
    it("should return a valid SVG path string", () => {
      const path = quadPath(0, 0, 100, 100, 0);
      expect(path).toMatch(/^M .+ Q .+ .+ .+$/);
    });

    it("should start with M command and end with coordinates", () => {
      const path = quadPath(10, 20, 30, 40, 0);
      expect(path).toContain("M 10 20");
      expect(path).toContain("30 40");
    });
  });
});
