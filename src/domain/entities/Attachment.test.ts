import { describe, it, expect } from "vitest";
import { Attachment } from "./Attachment";

describe("Attachment", () => {
  const validProps = {
    id: "attach-123",
    userId: "user-456",
    entryId: "entry-789",
    storageKey: "attachments/user-456/file.pdf",
    filename: "document.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    kind: "file" as const,
    status: "pending" as const,
    createdAt: new Date("2026-01-29T10:00:00Z"),
    updatedAt: new Date("2026-01-29T10:00:00Z"),
  };

  describe("create", () => {
    it("should create a valid attachment", () => {
      const result = Attachment.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("attach-123");
        expect(result.value.userId).toBe("user-456");
        expect(result.value.entryId).toBe("entry-789");
        expect(result.value.storageKey.toString()).toBe(
          "attachments/user-456/file.pdf",
        );
        expect(result.value.filename.toString()).toBe("document.pdf");
        expect(result.value.mimeType.toString()).toBe("application/pdf");
        expect(result.value.sizeBytes.toNumber()).toBe(1024);
        expect(result.value.kind.isFile()).toBe(true);
        expect(result.value.status.isPending()).toBe(true);
      }
    });

    it("should create inline attachment", () => {
      const result = Attachment.create({
        ...validProps,
        kind: "inline",
        mimeType: "image/png",
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.kind.isInline()).toBe(true);
      }
    });

    it("should create attachment with ready status", () => {
      const result = Attachment.create({
        ...validProps,
        status: "ready",
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status.isReady()).toBe(true);
      }
    });

    it("should create attachment with deleted status", () => {
      const result = Attachment.create({
        ...validProps,
        status: "deleted",
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status.isDeleted()).toBe(true);
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty id", () => {
      const result = Attachment.create({ ...validProps, id: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only id", () => {
      const result = Attachment.create({ ...validProps, id: "   " });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty userId", () => {
      const result = Attachment.create({ ...validProps, userId: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty entryId", () => {
      const result = Attachment.create({ ...validProps, entryId: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty storageKey", () => {
      const result = Attachment.create({ ...validProps, storageKey: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty filename", () => {
      const result = Attachment.create({ ...validProps, filename: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty mimeType", () => {
      const result = Attachment.create({ ...validProps, mimeType: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid mimeType format", () => {
      const result = Attachment.create({
        ...validProps,
        mimeType: "invalidtype",
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject negative sizeBytes", () => {
      const result = Attachment.create({ ...validProps, sizeBytes: -1 });
      expect(result.isErr()).toBe(true);
    });

    it("should reject NaN sizeBytes", () => {
      const result = Attachment.create({ ...validProps, sizeBytes: NaN });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid kind", () => {
      const result = Attachment.create({
        ...validProps,
        kind: "image" as "file",
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = Attachment.create({
        ...validProps,
        status: "uploading" as "pending",
      });
      expect(result.isErr()).toBe(true);
    });
  });

  describe("markReady", () => {
    it("should transition from pending to ready", () => {
      const result = Attachment.create({ ...validProps, status: "pending" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const ready = result.value.markReady();
        expect(ready.status.isReady()).toBe(true);
        expect(result.value.status.isPending()).toBe(true); // Original unchanged
      }
    });

    it("should update updatedAt", () => {
      const result = Attachment.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const ready = result.value.markReady();
        expect(ready.updatedAt.getTime()).toBeGreaterThanOrEqual(
          result.value.updatedAt.getTime(),
        );
      }
    });
  });

  describe("markDeleted", () => {
    it("should transition to deleted", () => {
      const result = Attachment.create({ ...validProps, status: "ready" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const deleted = result.value.markDeleted();
        expect(deleted.status.isDeleted()).toBe(true);
      }
    });
  });

  describe("isActive", () => {
    it("should return true for pending", () => {
      const result = Attachment.create({ ...validProps, status: "pending" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isActive()).toBe(true);
      }
    });

    it("should return true for ready", () => {
      const result = Attachment.create({ ...validProps, status: "ready" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isActive()).toBe(true);
      }
    });

    it("should return false for deleted", () => {
      const result = Attachment.create({ ...validProps, status: "deleted" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isActive()).toBe(false);
      }
    });
  });

  describe("toJSON", () => {
    it("should return plain object representation", () => {
      const result = Attachment.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.id).toBe("attach-123");
        expect(json.userId).toBe("user-456");
        expect(json.entryId).toBe("entry-789");
        expect(json.storageKey).toBe("attachments/user-456/file.pdf");
        expect(json.filename).toBe("document.pdf");
        expect(json.mimeType).toBe("application/pdf");
        expect(json.sizeBytes).toBe(1024);
        expect(json.kind).toBe("file");
        expect(json.status).toBe("pending");
        expect(json.createdAt).toBeInstanceOf(Date);
        expect(json.updatedAt).toBeInstanceOf(Date);
      }
    });
  });
});
