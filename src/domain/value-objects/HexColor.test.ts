import { describe, it, expect } from "vitest";
import { HexColor } from "./HexColor";

describe("HexColor", () => {
  describe("create", () => {
    it("should create a valid HexColor from #RRGGBB format", () => {
      const result = HexColor.create("#3b82f6");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("#3b82f6");
      }
    });

    it("should accept uppercase hex colors", () => {
      const result = HexColor.create("#FF5733");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should normalize to lowercase
        expect(result.value.toString()).toBe("#ff5733");
      }
    });

    it("should accept mixed case hex colors", () => {
      const result = HexColor.create("#aAbBcC");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("#aabbcc");
      }
    });

    it("should reject color without # prefix", () => {
      const result = HexColor.create("3b82f6");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid hex color");
      }
    });

    it("should reject color with wrong length (too short)", () => {
      const result = HexColor.create("#fff");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid hex color");
      }
    });

    it("should reject color with wrong length (too long)", () => {
      const result = HexColor.create("#3b82f6ff");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid hex color");
      }
    });

    it("should reject color with invalid characters", () => {
      const result = HexColor.create("#gggggg");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid hex color");
      }
    });

    it("should reject empty string", () => {
      const result = HexColor.create("");

      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only string", () => {
      const result = HexColor.create("   ");

      expect(result.isErr()).toBe(true);
    });
  });

  describe("equals", () => {
    it("should return true for equal colors", () => {
      const color1 = HexColor.create("#3b82f6");
      const color2 = HexColor.create("#3b82f6");

      expect(color1.isOk() && color2.isOk()).toBe(true);
      if (color1.isOk() && color2.isOk()) {
        expect(color1.value.equals(color2.value)).toBe(true);
      }
    });

    it("should return true for same color in different cases", () => {
      const color1 = HexColor.create("#aabbcc");
      const color2 = HexColor.create("#AABBCC");

      expect(color1.isOk() && color2.isOk()).toBe(true);
      if (color1.isOk() && color2.isOk()) {
        expect(color1.value.equals(color2.value)).toBe(true);
      }
    });

    it("should return false for different colors", () => {
      const color1 = HexColor.create("#3b82f6");
      const color2 = HexColor.create("#ef4444");

      expect(color1.isOk() && color2.isOk()).toBe(true);
      if (color1.isOk() && color2.isOk()) {
        expect(color1.value.equals(color2.value)).toBe(false);
      }
    });
  });
});
