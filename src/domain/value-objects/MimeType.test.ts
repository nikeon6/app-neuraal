import { describe, it, expect } from "vitest";
import { MimeType } from "./MimeType";

describe("MimeType", () => {
  describe("create", () => {
    it("should create valid image mime type", () => {
      const result = MimeType.create("image/png");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("image/png");
      }
    });

    it("should create valid application mime type", () => {
      const result = MimeType.create("application/pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("application/pdf");
      }
    });

    it("should accept common mime types", () => {
      const validTypes = [
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/octet-stream",
        "text/plain",
        "application/zip",
        "video/mp4",
      ];

      for (const type of validTypes) {
        const result = MimeType.create(type);
        expect(result.isOk()).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = MimeType.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only", () => {
      const result = MimeType.create("   ");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid format (no slash)", () => {
      const result = MimeType.create("imagepng");
      expect(result.isErr()).toBe(true);
    });

    it("should normalize to lowercase", () => {
      const result = MimeType.create("IMAGE/PNG");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("image/png");
      }
    });

    it("should trim whitespace", () => {
      const result = MimeType.create("  image/png  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("image/png");
      }
    });
  });

  describe("isImage", () => {
    it("should return true for image types", () => {
      const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

      for (const type of imageTypes) {
        const result = MimeType.create(type);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.isImage()).toBe(true);
        }
      }
    });

    it("should return false for non-image types", () => {
      const nonImageTypes = ["application/pdf", "text/plain", "video/mp4"];

      for (const type of nonImageTypes) {
        const result = MimeType.create(type);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.isImage()).toBe(false);
        }
      }
    });
  });

  describe("category", () => {
    it("should return category (type part)", () => {
      const result = MimeType.create("application/pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.category()).toBe("application");
      }
    });
  });

  describe("equals", () => {
    it("should return true for same type", () => {
      const a = MimeType.create("image/png");
      const b = MimeType.create("image/png");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("should return false for different types", () => {
      const a = MimeType.create("image/png");
      const b = MimeType.create("image/jpeg");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });
});
