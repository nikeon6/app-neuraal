import { describe, it, expect } from "vitest";
import { Filename } from "./Filename";

describe("Filename", () => {
  describe("create", () => {
    it("should create valid filename", () => {
      const result = Filename.create("document.pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("document.pdf");
      }
    });

    it("should accept filenames with spaces", () => {
      const result = Filename.create("my document.pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("my document.pdf");
      }
    });

    it("should accept filenames without extension", () => {
      const result = Filename.create("README");
      expect(result.isOk()).toBe(true);
    });

    it("should accept filenames with multiple dots", () => {
      const result = Filename.create("file.backup.2024.tar.gz");
      expect(result.isOk()).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Filename.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only", () => {
      const result = Filename.create("   ");
      expect(result.isErr()).toBe(true);
    });

    it("should trim whitespace", () => {
      const result = Filename.create("  document.pdf  ");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("document.pdf");
      }
    });

    it("should reject filename too long (255+ chars)", () => {
      const longName = "a".repeat(256);
      const result = Filename.create(longName);
      expect(result.isErr()).toBe(true);
    });

    it("should accept filename at max length (255 chars)", () => {
      const maxName = "a".repeat(255);
      const result = Filename.create(maxName);
      expect(result.isOk()).toBe(true);
    });

    it("should accept unicode characters", () => {
      const result = Filename.create("文档.pdf");
      expect(result.isOk()).toBe(true);
    });

    it("should accept emojis", () => {
      const result = Filename.create("📄 document.pdf");
      expect(result.isOk()).toBe(true);
    });
  });

  describe("extension", () => {
    it("should return extension", () => {
      const result = Filename.create("document.pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.extension()).toBe("pdf");
      }
    });

    it("should return last extension for multiple dots", () => {
      const result = Filename.create("file.tar.gz");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.extension()).toBe("gz");
      }
    });

    it("should return empty string when no extension", () => {
      const result = Filename.create("README");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.extension()).toBe("");
      }
    });

    it("should return lowercase extension", () => {
      const result = Filename.create("document.PDF");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.extension()).toBe("pdf");
      }
    });
  });

  describe("baseName", () => {
    it("should return name without extension", () => {
      const result = Filename.create("document.pdf");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.baseName()).toBe("document");
      }
    });

    it("should return full name when no extension", () => {
      const result = Filename.create("README");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.baseName()).toBe("README");
      }
    });
  });

  describe("equals", () => {
    it("should return true for same filename", () => {
      const a = Filename.create("document.pdf");
      const b = Filename.create("document.pdf");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("should return false for different filenames", () => {
      const a = Filename.create("document.pdf");
      const b = Filename.create("other.pdf");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });
});
