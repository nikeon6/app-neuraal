import { describe, it, expect, beforeEach } from "vitest";
import { ListAttachmentsByEntry } from "./ListAttachmentsByEntry";
import { InitAttachmentUpload } from "./InitAttachmentUpload";
import { CompleteAttachmentUpload } from "./CompleteAttachmentUpload";
import { DeleteAttachment } from "./DeleteAttachment";
import { CreateEntry } from "../entries/CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../../test/FakeObjectStorage";
import { Bytes } from "@/domain/value-objects/Bytes";

describe("ListAttachmentsByEntry", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let listAttachments: ListAttachmentsByEntry;
  let initUpload: InitAttachmentUpload;
  let completeUpload: CompleteAttachmentUpload;
  let deleteAttachment: DeleteAttachment;
  let createEntry: CreateEntry;

  const quotaConfig = {
    maxEntryAttachmentSizeBytes: Bytes.fromNumber(20 * 1024 * 1024),
    maxUserStorageQuotaBytes: Bytes.fromNumber(100 * 1024 * 1024),
  };

  const limits = {
    entryLimitBytes: 20 * 1024 * 1024,
    userLimitBytes: 100 * 1024 * 1024,
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    attachmentRepository = new InMemoryAttachmentRepository();
    objectStorage = new FakeObjectStorage();
    listAttachments = new ListAttachmentsByEntry(
      entryRepository,
      attachmentRepository,
      limits,
    );
    initUpload = new InitAttachmentUpload(
      entryRepository,
      attachmentRepository,
      objectStorage,
      quotaConfig,
    );
    completeUpload = new CompleteAttachmentUpload(attachmentRepository);
    deleteAttachment = new DeleteAttachment(
      attachmentRepository,
      objectStorage,
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

  async function addAttachment(
    userId: string,
    entryId: string,
    filename: string,
    sizeBytes = 1024,
  ) {
    const initResult = await initUpload.execute({
      userId,
      entryId,
      filename,
      mimeType: "application/pdf",
      sizeBytes,
      kind: "file",
    });
    if (initResult.isErr()) throw new Error("Failed to init attachment");
    return initResult.value.attachment;
  }

  describe("successful listing", () => {
    it("should return empty list for entry with no attachments", async () => {
      const entry = await createTestEntry("user-123");

      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachments).toHaveLength(0);
      }
    });

    it("should return pending and ready attachments", async () => {
      const entry = await createTestEntry("user-123");
      await addAttachment("user-123", entry.id, "pending.pdf");
      const readyAtt = await addAttachment("user-123", entry.id, "ready.pdf");
      await completeUpload.execute({
        userId: "user-123",
        attachmentId: readyAtt.id,
      });

      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachments).toHaveLength(2);
      }
    });

    it("should exclude deleted attachments", async () => {
      const entry = await createTestEntry("user-123");
      const att = await addAttachment("user-123", entry.id, "to-delete.pdf");
      await completeUpload.execute({
        userId: "user-123",
        attachmentId: att.id,
      });
      await deleteAttachment.execute({
        userId: "user-123",
        attachmentId: att.id,
      });

      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachments).toHaveLength(0);
      }
    });

    it("should include usage data", async () => {
      const entry = await createTestEntry("user-123");
      await addAttachment("user-123", entry.id, "file.pdf", 5000);

      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.usage.entryBytesUsed).toBe(5000);
        expect(result.value.usage.entryLimitBytes).toBe(limits.entryLimitBytes);
        expect(result.value.usage.userBytesUsed).toBe(5000);
        expect(result.value.usage.userLimitBytes).toBe(limits.userLimitBytes);
      }
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND for non-existent entry", async () => {
      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: "non-existent",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when entry belongs to another user", async () => {
      const entry = await createTestEntry("user-123");

      const result = await listAttachments.execute({
        userId: "user-456",
        entryId: entry.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const result = await listAttachments.execute({
        userId: "",
        entryId: "some-id",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty entryId", async () => {
      const result = await listAttachments.execute({
        userId: "user-123",
        entryId: "",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
