import { describe, it, expect } from "vitest";
import { AttachmentStatus } from "./AttachmentStatus";

describe("AttachmentStatus", () => {
  describe("create", () => {
    it("should create 'pending' status", () => {
      const result = AttachmentStatus.create("pending");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("pending");
        expect(result.value.isPending()).toBe(true);
        expect(result.value.isReady()).toBe(false);
        expect(result.value.isDeleted()).toBe(false);
      }
    });

    it("should create 'ready' status", () => {
      const result = AttachmentStatus.create("ready");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("ready");
        expect(result.value.isPending()).toBe(false);
        expect(result.value.isReady()).toBe(true);
        expect(result.value.isDeleted()).toBe(false);
      }
    });

    it("should create 'deleted' status", () => {
      const result = AttachmentStatus.create("deleted");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("deleted");
        expect(result.value.isPending()).toBe(false);
        expect(result.value.isReady()).toBe(false);
        expect(result.value.isDeleted()).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = AttachmentStatus.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = AttachmentStatus.create("uploading");
      expect(result.isErr()).toBe(true);
    });

    it("should reject uppercase", () => {
      const result = AttachmentStatus.create("PENDING");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("factory methods", () => {
    it("should create pending status", () => {
      const status = AttachmentStatus.pending();
      expect(status.isPending()).toBe(true);
    });

    it("should create ready status", () => {
      const status = AttachmentStatus.ready();
      expect(status.isReady()).toBe(true);
    });

    it("should create deleted status", () => {
      const status = AttachmentStatus.deleted();
      expect(status.isDeleted()).toBe(true);
    });
  });

  describe("isActive", () => {
    it("should return true for pending", () => {
      const status = AttachmentStatus.pending();
      expect(status.isActive()).toBe(true);
    });

    it("should return true for ready", () => {
      const status = AttachmentStatus.ready();
      expect(status.isActive()).toBe(true);
    });

    it("should return false for deleted", () => {
      const status = AttachmentStatus.deleted();
      expect(status.isActive()).toBe(false);
    });
  });

  describe("equals", () => {
    it("should return true for same status", () => {
      const a = AttachmentStatus.pending();
      const b = AttachmentStatus.pending();
      expect(a.equals(b)).toBe(true);
    });

    it("should return false for different status", () => {
      const a = AttachmentStatus.pending();
      const b = AttachmentStatus.ready();
      expect(a.equals(b)).toBe(false);
    });
  });
});
