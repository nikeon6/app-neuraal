import { describe, it, expect, beforeEach } from "vitest";
import { UpdateEntry } from "./UpdateEntry";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";

describe("UpdateEntry", () => {
  let repository: InMemoryEntryRepository;
  let updateEntry: UpdateEntry;
  let createEntry: CreateEntry;

  beforeEach(() => {
    repository = new InMemoryEntryRepository();
    updateEntry = new UpdateEntry(repository);
    createEntry = new CreateEntry(repository);
  });

  async function createTestEntry(
    userId: string,
    options: {
      type?: "task" | "note";
      title?: string;
    } = {},
  ) {
    const { type = "task", title = "Test Entry" } = options;
    const result = await createEntry.execute({
      userId,
      date: "2026-01-29",
      type,
      title,
      content: { original: true },
      completed: type === "task" ? false : undefined,
    });
    if (result.isErr()) throw new Error("Failed to create test entry");
    return result.value;
  }

  describe("successful updates", () => {
    it("should update title", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "Updated Title",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("Updated Title");
      }
    });

    it("should update content", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        content: { updated: true },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toEqual({ updated: true });
      }
    });

    it("should update topicId", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        topicId: "topic-456",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.topicId).toBe("topic-456");
      }
    });

    it("should update topicId to null", async () => {
      const entry = await createTestEntry("user-123");

      // First set topicId
      await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        topicId: "topic-456",
      });

      // Then set to null
      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 2,
        topicId: null,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.topicId).toBeNull();
      }
    });

    it("should update completed on task", async () => {
      const entry = await createTestEntry("user-123", { type: "task" });

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        completed: true,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.completed).toBe(true);
      }
    });

    it("should increment version after update", async () => {
      const entry = await createTestEntry("user-123");
      expect(entry.version).toBe(1);

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "Updated",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.version).toBe(2);
      }
    });

    it("should persist updated entry", async () => {
      const entry = await createTestEntry("user-123");

      await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "Updated",
      });

      const found = await repository.findById(entry.id);
      expect(found?.title.toString()).toBe("Updated");
    });

    it("should allow multiple sequential updates", async () => {
      const entry = await createTestEntry("user-123");

      await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "Update 1",
      });

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 2,
        title: "Update 2",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("Update 2");
        expect(result.value.version).toBe(3);
      }
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when entry does not exist", async () => {
      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: "non-existent-id",
        version: 1,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when entry belongs to another user", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-456", // Different user
        entryId: entry.id,
        version: 1,
        title: "Hacked",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }

      // Verify entry was not modified
      const found = await repository.findById(entry.id);
      expect(found?.title.toString()).toBe("Test Entry");
    });
  });

  describe("version conflict", () => {
    it("should return CONFLICT when version does not match", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 2, // Wrong version
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });

    it("should return CONFLICT for stale version after update", async () => {
      const entry = await createTestEntry("user-123");

      // First update succeeds
      await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "Update 1",
      });

      // Second update with stale version fails
      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1, // Stale
        title: "Update 2",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });

    it("should include current version in conflict error", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 99,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("1"); // Current version
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "",
        entryId: entry.id,
        version: 1,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty entryId", async () => {
      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: "",
        version: 1,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should silently reset completed to null on note", async () => {
      const entry = await createTestEntry("user-123", { type: "note" });

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        completed: true,
      });

      // Domain now accepts completed on notes but resets to null
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.completed).toBeNull();
      }
    });

    it("should reject title too long", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        title: "a".repeat(121),
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject non-object content", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
        content: "string" as unknown as Record<string, unknown>,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject missing version", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: undefined as unknown as number,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject version < 1", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 0,
        title: "Updated",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject when no fields to update", async () => {
      const entry = await createTestEntry("user-123");

      const result = await updateEntry.execute({
        userId: "user-123",
        entryId: entry.id,
        version: 1,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
