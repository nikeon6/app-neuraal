import { describe, it, expect, beforeEach } from "vitest";
import { ExtractImageText } from "./ExtractImageText";
import { InitAttachmentUpload } from "../attachments/InitAttachmentUpload";
import { CompleteAttachmentUpload } from "../attachments/CompleteAttachmentUpload";
import { CreateEntry } from "../entries/CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryAttachmentRepository } from "../../test/InMemoryAttachmentRepository";
import { FakeObjectStorage } from "../../test/FakeObjectStorage";
import type { OcrPort } from "../../ports/OcrPort";
import { Bytes } from "@/domain/value-objects/Bytes";

/**
 * Fake OCR provider for testing.
 */
class FakeOcrProvider implements OcrPort {
  public lastImageBase64: string | null = null;
  public lastMimeType: string | null = null;
  public responseText = "Invoice #1234\nTotal: $99.99";
  public shouldThrow = false;
  public errorMessage = "OCR service unavailable";

  async extractText(imageBase64: string, mimeType: string): Promise<string> {
    this.lastImageBase64 = imageBase64;
    this.lastMimeType = mimeType;
    if (this.shouldThrow) {
      throw new Error(this.errorMessage);
    }
    return this.responseText;
  }
}

describe("ExtractImageText", () => {
  let entryRepository: InMemoryEntryRepository;
  let attachmentRepository: InMemoryAttachmentRepository;
  let objectStorage: FakeObjectStorage;
  let ocrProvider: FakeOcrProvider;
  let useCase: ExtractImageText;
  let initUpload: InitAttachmentUpload;
  let completeUpload: CompleteAttachmentUpload;
  let createEntry: CreateEntry;

  const userId = "user-ocr-1";
  const config = {
    maxEntryAttachmentSizeBytes: Bytes.fromNumber(20 * 1024 * 1024),
    maxUserStorageQuotaBytes: Bytes.fromNumber(100 * 1024 * 1024),
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    attachmentRepository = new InMemoryAttachmentRepository();
    objectStorage = new FakeObjectStorage();
    ocrProvider = new FakeOcrProvider();
    initUpload = new InitAttachmentUpload(
      entryRepository,
      attachmentRepository,
      objectStorage,
      config
    );
    completeUpload = new CompleteAttachmentUpload(attachmentRepository);
    createEntry = new CreateEntry(entryRepository);
    useCase = new ExtractImageText(
      entryRepository,
      attachmentRepository,
      objectStorage,
      ocrProvider
    );
  });

  async function createTestEntry(uid: string = userId) {
    const result = await createEntry.execute({
      userId: uid,
      date: "2026-01-29",
      type: "task",
      title: "Test Entry",
      content: {},
      completed: false,
    });
    if (result.isErr()) throw new Error("Failed to create test entry");
    return result.value;
  }

  async function createReadyImageAttachment(
    uid: string,
    entryId: string,
    filename = "photo.jpg",
    mimeType = "image/jpeg"
  ) {
    const initResult = await initUpload.execute({
      userId: uid,
      entryId,
      filename,
      mimeType,
      sizeBytes: 2048,
      kind: "inline",
    });
    if (initResult.isErr()) throw new Error("Failed to init attachment");

    // Put fake image data into storage so getObjectBuffer works
    objectStorage.putObject(
      initResult.value.attachment.storageKey,
      Buffer.from("fake-image-data")
    );

    const completeResult = await completeUpload.execute({
      userId: uid,
      attachmentId: initResult.value.attachment.id,
    });
    if (completeResult.isErr()) throw new Error("Failed to complete attachment");
    return completeResult.value;
  }

  // ---- Successful OCR ----

  describe("successful OCR extraction", () => {
    it("should extract text from a ready image attachment", async () => {
      const entry = await createTestEntry();
      const attachment = await createReadyImageAttachment(userId, entry.id);

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: attachment.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.attachmentId).toBe(attachment.id);
        expect(result.value.extractedText).toBe("Invoice #1234\nTotal: $99.99");
      }
    });

    it("should pass correct base64 and mime type to OCR provider", async () => {
      const entry = await createTestEntry();
      const attachment = await createReadyImageAttachment(
        userId,
        entry.id,
        "screenshot.png",
        "image/png"
      );

      await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: attachment.id,
      });

      expect(ocrProvider.lastImageBase64).toBe(
        Buffer.from("fake-image-data").toString("base64")
      );
      expect(ocrProvider.lastMimeType).toBe("image/png");
    });

    it("should trim whitespace from extracted text", async () => {
      ocrProvider.responseText = "  some text with spaces  \n\n";
      const entry = await createTestEntry();
      const attachment = await createReadyImageAttachment(userId, entry.id);

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: attachment.id,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.extractedText).toBe("some text with spaces");
      }
    });
  });

  // ---- Input validation ----

  describe("input validation", () => {
    it("should reject empty userId", async () => {
      const result = await useCase.execute({
        userId: "",
        entryId: "entry-1",
        attachmentId: "att-1",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("userId");
      }
    });

    it("should reject empty entryId", async () => {
      const result = await useCase.execute({
        userId: "user-1",
        entryId: "",
        attachmentId: "att-1",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("entryId");
      }
    });

    it("should reject empty attachmentId", async () => {
      const result = await useCase.execute({
        userId: "user-1",
        entryId: "entry-1",
        attachmentId: "",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("attachmentId");
      }
    });
  });

  // ---- Ownership & existence validation ----

  describe("ownership and existence checks", () => {
    it("should return NOT_FOUND when entry does not exist", async () => {
      const result = await useCase.execute({
        userId,
        entryId: "non-existent",
        attachmentId: "att-1",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("Entry");
      }
    });

    it("should return NOT_FOUND when entry belongs to different user", async () => {
      const entry = await createTestEntry("other-user");
      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: "att-1",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when attachment does not exist", async () => {
      const entry = await createTestEntry();
      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: "non-existent",
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when attachment belongs to different entry", async () => {
      const entry1 = await createTestEntry();
      const entry2 = await createTestEntry();
      const attachment = await createReadyImageAttachment(userId, entry1.id);

      const result = await useCase.execute({
        userId,
        entryId: entry2.id,
        attachmentId: attachment.id,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  // ---- Status & type validation ----

  describe("attachment status and type checks", () => {
    it("should reject pending attachment", async () => {
      const entry = await createTestEntry();
      const initResult = await initUpload.execute({
        userId,
        entryId: entry.id,
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        kind: "inline",
      });
      if (initResult.isErr()) throw new Error("Failed");

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: initResult.value.attachment.id,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("not ready");
      }
    });

    it("should reject non-image attachment", async () => {
      const entry = await createTestEntry();
      const initResult = await initUpload.execute({
        userId,
        entryId: entry.id,
        filename: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        kind: "file",
      });
      if (initResult.isErr()) throw new Error("Failed");
      objectStorage.putObject(
        initResult.value.attachment.storageKey,
        Buffer.from("fake-pdf-data")
      );
      await completeUpload.execute({
        userId,
        attachmentId: initResult.value.attachment.id,
      });

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: initResult.value.attachment.id,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("not an image");
      }
    });
  });

  // ---- Error handling ----

  describe("error handling", () => {
    it("should return INTERNAL_ERROR when OCR provider fails", async () => {
      ocrProvider.shouldThrow = true;
      ocrProvider.errorMessage = "Model not loaded";

      const entry = await createTestEntry();
      const attachment = await createReadyImageAttachment(userId, entry.id);

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
        expect(result.error.message).toContain("OCR processing failed");
        expect(result.error.message).toContain("Model not loaded");
      }
    });

    it("should return INTERNAL_ERROR when storage download fails", async () => {
      const entry = await createTestEntry();
      // Create attachment but do NOT put data in storage
      const initResult = await initUpload.execute({
        userId,
        entryId: entry.id,
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        kind: "inline",
      });
      if (initResult.isErr()) throw new Error("Failed");
      // Complete without storing data -> getObjectBuffer will throw
      await completeUpload.execute({
        userId,
        attachmentId: initResult.value.attachment.id,
      });

      const result = await useCase.execute({
        userId,
        entryId: entry.id,
        attachmentId: initResult.value.attachment.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("INTERNAL_ERROR");
        expect(result.error.message).toContain("Failed to download image");
      }
    });
  });
});
