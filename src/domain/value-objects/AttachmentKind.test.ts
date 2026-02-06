import { describe, it, expect } from "vitest";
import { AttachmentKind } from "./AttachmentKind";

describe("AttachmentKind", () => {
  describe("create", () => {
    it("should create 'inline' kind", () => {
      const result = AttachmentKind.create("inline");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("inline");
        expect(result.value.isInline()).toBe(true);
        expect(result.value.isFile()).toBe(false);
      }
    });

    it("should create 'file' kind", () => {
      const result = AttachmentKind.create("file");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("file");
        expect(result.value.isInline()).toBe(false);
        expect(result.value.isFile()).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = AttachmentKind.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid kind", () => {
      const result = AttachmentKind.create("image");
      expect(result.isErr()).toBe(true);
    });

    it("should reject uppercase", () => {
      const result = AttachmentKind.create("INLINE");
      expect(result.isErr()).toBe(true);
    });

    it("should reject with spaces", () => {
      const result = AttachmentKind.create(" inline ");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("equals", () => {
    it("should return true for same kind", () => {
      const a = AttachmentKind.create("inline");
      const b = AttachmentKind.create("inline");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(true);
      }
    });

    it("should return false for different kinds", () => {
      const a = AttachmentKind.create("inline");
      const b = AttachmentKind.create("file");

      expect(a.isOk() && b.isOk()).toBe(true);
      if (a.isOk() && b.isOk()) {
        expect(a.value.equals(b.value)).toBe(false);
      }
    });
  });
});
