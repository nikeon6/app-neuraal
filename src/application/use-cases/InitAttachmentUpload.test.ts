import { describe, it, expect, beforeEach } from "vitest";
import { InitAttachmentUpload } from "./InitAttachmentUpload";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../test/FakeObjectStorage";
import { Bytes } from "@/domain/value-objects/Bytes";

describe("InitAttachmentUpload", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let initUpload: InitAttachmentUpload;
  let createEntry: CreateEntry;

  // Configurable limits for tests
  const maxEntrySize = Bytes.fromNumber(20 * 1024 * 1024); // 20MB
  const maxUserQuota = Bytes.fromNumber(100 * 1024 * 1024); // 100MB for easier testing

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    attachmentRepository = new InMemoryAttachmentRepository();
    objectStorage = new FakeObjectStorage();
    initUpload = new InitAttachmentUpload(
      entryRepository,
      attachmentRepository,
      objectStorage,
      { maxEntryAttachmentSizeBytes: maxEntrySize, maxUserStorageQuotaBytes: maxUserQuota }
    );
    createEntry = new CreateEntry(entryRepository);
  });

  async function createTestEntry(userId: string) {
    const result = await createEntry.execute({
      userId,
      date: "2026-01-29",
      type: "task",
      title: "Test Entry",
      content: {},
      completed: false,
    });
    if (result.isErr()) throw new Error("Failed to create test entry");
    return result.value;
  }

  describe("successful upload init", () => {
    it("should create pending attachment and return presigned URL", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachment.status).toBe("pending");
        expect(result.value.attachment.filename).toBe("document.pdf");
        expect(result.value.presignedPutUrl).toContain("https://");
      }
    });

    it("should persist attachment in repository", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "image.png",
        mimeType: "image/png",
        sizeBytes: 5000,
        kind: "inline",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const saved = await attachmentRepository.findById(result.value.attachment.id);
        expect(saved).not.toBeNull();
        expect(saved?.status.isPending()).toBe(true);
      }
    });

    it("should generate unique storage key", async () => {
      const entry = await createTestEntry("user-123");

      const result1 = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      const result2 = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result1.isOk() && result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.attachment.storageKey).not.toBe(
          result2.value.attachment.storageKey
        );
      }
    });

    it("should include userId in storage key", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachment.storageKey).toContain("user-123");
      }
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when entry does not exist", async () => {
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: "non-existent-entry",
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when entry belongs to another user", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-456", // Different user
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("quota validation", () => {
    it("should reject if file exceeds entry quota", async () => {
      const entry = await createTestEntry("user-123");

      // Try to upload file larger than entry limit (20MB)
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "huge.pdf",
        mimeType: "application/pdf",
        sizeBytes: 25 * 1024 * 1024, // 25MB
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("QUOTA_EXCEEDED");
        expect(result.error.message.toLowerCase()).toContain("entry");
      }
    });

    it("should reject if sum of files exceeds entry quota", async () => {
      const entry = await createTestEntry("user-123");

      // First upload - 15MB
      await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 15 * 1024 * 1024,
        kind: "file",
      });

      // Second upload - 10MB (total 25MB > 20MB limit)
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10 * 1024 * 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("QUOTA_EXCEEDED");
      }
    });

    it("should reject if user storage quota exceeded", async () => {
      // Create 6 entries to distribute uploads (avoiding entry limit)
      const entries = [];
      for (let i = 0; i < 6; i++) {
        const entryResult = await createEntry.execute({
          userId: "user-123",
          date: `2026-01-${20 + i}`,
          type: "task",
          title: `Entry ${i}`,
          content: {},
          completed: false,
        });
        if (entryResult.isErr()) throw new Error("Failed");
        entries.push(entryResult.value);
      }

      // Upload 18MB to each of 5 entries = 90MB total
      for (let i = 0; i < 5; i++) {
        await initUpload.execute({
          userId: "user-123",
          entryId: entries[i].id,
          filename: `file${i}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 18 * 1024 * 1024,
          kind: "file",
        });
      }

      // Now try to exceed user quota (100MB) with 15MB more on a fresh entry
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entries[5].id,
        filename: "overflow.pdf",
        mimeType: "application/pdf",
        sizeBytes: 15 * 1024 * 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("QUOTA_EXCEEDED");
        expect(result.error.message.toLowerCase()).toContain("user");
      }
    });

    it("should consider pending attachments in quota calculation", async () => {
      const entry = await createTestEntry("user-123");

      // First pending upload - 15MB
      await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "pending.pdf",
        mimeType: "application/pdf",
        sizeBytes: 15 * 1024 * 1024,
        kind: "file",
      });

      // Second upload should consider pending
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "another.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10 * 1024 * 1024, // Would exceed 20MB
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("QUOTA_EXCEEDED");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty entryId", async () => {
      const result = await initUpload.execute({
        userId: "user-123",
        entryId: "",
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject empty filename", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject empty mimeType", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid mimeType format", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "invalidtype",
        sizeBytes: 1024,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject zero sizeBytes", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject negative sizeBytes", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: -100,
        kind: "file",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid kind", async () => {
      const entry = await createTestEntry("user-123");

      const result = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "image" as "file",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
