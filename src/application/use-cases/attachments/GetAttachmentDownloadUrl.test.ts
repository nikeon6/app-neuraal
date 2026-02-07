import { describe, it, expect, beforeEach } from "vitest";
import { InitAttachmentUpload } from "./InitAttachmentUpload";
import { CompleteAttachmentUpload } from "./CompleteAttachmentUpload";
import { GetAttachmentDownloadUrl } from "./GetAttachmentDownloadUrl";
import { CreateEntry } from "../entries/CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../../test/FakeObjectStorage";
import { Bytes } from "@/domain/value-objects/Bytes";

describe("GetAttachmentDownloadUrl", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let initUpload: InitAttachmentUpload;
  let completeUpload: CompleteAttachmentUpload;
  let getDownloadUrl: GetAttachmentDownloadUrl;
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
    getDownloadUrl = new GetAttachmentDownloadUrl(
      attachmentRepository,
      objectStorage
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

  describe("successful download URL", () => {
    it("should return presigned GET URL for ready attachment", async () => {
      const entry = await createTestEntry("user-123");
      const attachment = await createReadyAttachment("user-123", entry.id);

      const result = await getDownloadUrl.execute({
        userId: "user-123",
        attachmentId: attachment.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.presignedGetUrl).toContain("https://");
        expect(result.value.presignedGetUrl).toContain(attachment.storageKey);
      }
    });
  });

  describe("status validation", () => {
    it("should reject pending attachment", async () => {
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

      const result = await getDownloadUrl.execute({
        userId: "user-123",
        attachmentId: initResult.value.attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when attachment does not exist", async () => {
      const result = await getDownloadUrl.execute({
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

      const result = await getDownloadUrl.execute({
        userId: "user-456", // Different user
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
      const result = await getDownloadUrl.execute({
        userId: "",
        attachmentId: "some-id",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty attachmentId", async () => {
      const result = await getDownloadUrl.execute({
        userId: "user-123",
        attachmentId: "",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
