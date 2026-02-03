import { describe, it, expect, beforeEach } from "vitest";
import { InitAttachmentUpload } from "./InitAttachmentUpload";
import { CompleteAttachmentUpload } from "./CompleteAttachmentUpload";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../test/FakeObjectStorage";
import { Bytes } from "@/domain/value-objects/Bytes";

describe("CompleteAttachmentUpload", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let initUpload: InitAttachmentUpload;
  let completeUpload: CompleteAttachmentUpload;
  let createEntry: CreateEntry;

  const config = {
    maxEntryAttachmentSizeBytes: Bytes.fromNumber(20 * 1024 * 1024),
    maxUserStorageQuotaBytes: Bytes.fromNumber(100 * 1024 * 1024),
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    attachmentRepository = new InMemoryAttachmentRepository();
    objectStorage = new FakeObjectStorage();
    initUpload = new InitAttachmentUpload(
      entryRepository,
      attachmentRepository,
      objectStorage,
      config
    );
    completeUpload = new CompleteAttachmentUpload(attachmentRepository);
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

  async function initTestAttachment(userId: string, entryId: string) {
    const result = await initUpload.execute({
      userId,
      entryId,
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
    });
    if (result.isErr()) throw new Error("Failed to init attachment");
    return result.value.attachment;
  }

  describe("successful completion", () => {
    it("should mark attachment as ready", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await initTestAttachment("user-123", entry.id);

      const result = await completeUpload.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("ready");
      }
    });

    it("should persist ready status", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await initTestAttachment("user-123", entry.id);

      await completeUpload.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      const saved = await attachmentRepository.findById(attachment.id);
      expect(saved?.status.isReady()).toBe(true);
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when attachment does not exist", async () => {
      const result = await completeUpload.execute({
        userId: "user-123",
        attachmentId: "non-existent",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when attachment belongs to another user", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await initTestAttachment("user-123", entry.id);

      const result = await completeUpload.execute({
        userId: "user-456", // Different user
        attachmentId: attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }

      // Verify attachment was not modified
      const saved = await attachmentRepository.findById(attachment.id);
      expect(saved?.status.isPending()).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await initTestAttachment("user-123", entry.id);

      const result = await completeUpload.execute({
        userId: "",
        attachmentId: attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty attachmentId", async () => {
      const result = await completeUpload.execute({
        userId: "user-123",
        attachmentId: "",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
