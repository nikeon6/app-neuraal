import { describe, it, expect, beforeEach } from "vitest";
import { DeleteEntry } from "./DeleteEntry";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";

describe("DeleteEntry", () => {
  let repository: InMemoryEntryRepository;
  let deleteEntry: DeleteEntry;
  let createEntry: CreateEntry;

  beforeEach(() => {
    repository = new InMemoryEntryRepository();
    deleteEntry = new DeleteEntry(repository);
    createEntry = new CreateEntry(repository);
  });

  async function createTestEntry(userId: string, title = "Test Entry") {
    const result = await createEntry.execute({
      userId,
      date: "2026-01-29",
      type: "task",
      title,
      content: {},
      completed: false,
    });
    if (result.isErr()) throw new Error("Failed to create test entry");
    return result.value;
  }

  describe("successful deletion", () => {
    it("should delete an existing entry", async () => {
      const entry = await createTestEntry("user-123");

      const result = await deleteEntry.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      expect(result.isOk()).toBe(true);
    });

    it("should remove entry from repository", async () => {
      const entry = await createTestEntry("user-123");

      await deleteEntry.execute({
        userId: "user-123",
        entryId: entry.id,
      });

      const found = await repository.findById(entry.id);
      expect(found).toBeNull();
    });

    it("should only delete the specified entry", async () => {
      const entry1 = await createTestEntry("user-123", "Entry 1");
      const entry2 = await createTestEntry("user-123", "Entry 2");

      await deleteEntry.execute({
        userId: "user-123",
        entryId: entry1.id,
      });

      const remaining = repository.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(entry2.id);
    });
  });

  describe("ownership validation", () => {
    it("should return NOT_FOUND when entry does not exist", async () => {
      const result = await deleteEntry.execute({
        userId: "user-123",
        entryId: "non-existent-id",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should return NOT_FOUND when entry belongs to another user", async () => {
      const entry = await createTestEntry("user-123");

      const result = await deleteEntry.execute({
        userId: "user-456", // Different user
        entryId: entry.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }

      // Verify entry was not deleted
      const found = await repository.findById(entry.id);
      expect(found).not.toBeNull();
    });

    it("should not leak entry existence to unauthorized users", async () => {
      const entry = await createTestEntry("user-123", "Secret Entry");

      const result = await deleteEntry.execute({
        userId: "attacker",
        entryId: entry.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).not.toContain("Secret Entry");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const entry = await createTestEntry("user-123");

      const result = await deleteEntry.execute({
        userId: "",
        entryId: entry.id,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace-only userId", async () => {
      const entry = await createTestEntry("user-123");

      const result = await deleteEntry.execute({
        userId: "   ",
        entryId: entry.id,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject empty entryId", async () => {
      const result = await deleteEntry.execute({
        userId: "user-123",
        entryId: "",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace-only entryId", async () => {
      const result = await deleteEntry.execute({
        userId: "user-123",
        entryId: "   ",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
