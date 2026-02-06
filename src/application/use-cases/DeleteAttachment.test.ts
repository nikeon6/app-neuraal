import { describe, it, expect, beforeEach } from "vitest";
import { InitAttachmentUpload } from "./InitAttachmentUpload";
import { CompleteAttachmentUpload } from "./CompleteAttachmentUpload";
import { DeleteAttachment } from "./DeleteAttachment";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../test/FakeObjectStorage";
import { Bytes } from "@/domain/value-objects/Bytes";

describe("DeleteAttachment", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let initUpload: InitAttachmentUpload;
  let completeUpload: CompleteAttachmentUpload;
  let deleteAttachment: DeleteAttachment;
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
    deleteAttachment = new DeleteAttachment(attachmentRepository, objectStorage);
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

  async function createReadyAttachment(userId: string, entryId: string) {
    const initResult = await initUpload.execute({
      userId,
      entryId,
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      kind: "file",
    });
    if (initResult.isErr()) throw new Error("Failed to init attachment");

    const completeResult = await completeUpload.execute({
      userId,
      attachmentId: initResult.value.attachment.id,
    });
    if (completeResult.isErr()) throw new Error("Failed to complete attachment");

    return completeResult.value;
  }

  describe("successful deletion", () => {
    it("should mark attachment as deleted", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await createReadyAttachment("user-123", entry.id);

      const result = await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      expect(result.isOk()).toBe(true);
    });

    it("should update status to deleted in repository", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await createReadyAttachment("user-123", entry.id);

      await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      const saved = await attachmentRepository.findById(attachment.id);
      expect(saved?.status.isDeleted()).toBe(true);
    });

    it("should delete object from storage", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await createReadyAttachment("user-123", entry.id);
      const storageKey = attachment.storageKey;

      await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      expect(objectStorage.wasDeleted(storageKey)).toBe(true);
    });

    it("should allow deleting pending attachment", async () => {
      const entry = await createTestEntry("user-123");
      const initResult = await initUpload.execute({
        userId: "user-123",
        entryId: entry.id,
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });
      if (initResult.isErr()) throw new Error("Failed");

      const result = await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: initResult.value.attachment.id,
      });

      expect(result.isOk()).toBe(true);
      expect(objectStorage.wasDeleted(initResult.value.attachment.storageKey)).toBe(true);
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when attachment does not exist", async () => {
      const result = await deleteAttachment.execute({
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
      const attachment = await createReadyAttachment("user-123", entry.id);

      const result = await deleteAttachment.execute({
        userId: "user-456", // Different user
        attachmentId: attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }

      // Verify attachment was not modified
      const saved = await attachmentRepository.findById(attachment.id);
      expect(saved?.status.isReady()).toBe(true);
      expect(objectStorage.wasDeleted(attachment.storageKey)).toBe(false);
    });
  });

  describe("already deleted", () => {
    it("should return NOT_FOUND for already deleted attachment", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await createReadyAttachment("user-123", entry.id);

      // First delete
      await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      // Second delete
      const result = await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const result = await deleteAttachment.execute({
        userId: "",
        attachmentId: "some-id",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty attachmentId", async () => {
      const result = await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: "",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
