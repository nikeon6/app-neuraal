import { describe, it, expect, beforeEach } from "vitest";
import { ReorderEntries } from "./ReorderEntries";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";

describe("ReorderEntries", () => {
  let repository: InMemoryEntryRepository;
  let reorderEntries: ReorderEntries;
  let createEntry: CreateEntry;

  beforeEach(() => {
    repository = new InMemoryEntryRepository();
    reorderEntries = new ReorderEntries(repository);
    createEntry = new CreateEntry(repository);
  });

  /** Helper: create a task and return its ID */
  async function addTask(title: string, date = "2026-01-29"): Promise<string> {
    const result = await createEntry.execute({
      userId: "user-123",
      date,
      type: "task",
      title,
      content: { text: title },
      completed: false,
    });
    if (result.isErr()) throw new Error(`Failed to create task: ${result.error.message}`);
    return result.value.id;
  }

  describe("successful reorder", () => {
    it("should update sortOrder for all entries", async () => {
      const id1 = await addTask("Task A");
      const id2 = await addTask("Task B");
      const id3 = await addTask("Task C");

      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
        orderedIds: [id3, id1, id2],
      });

      expect(result.isOk()).toBe(true);

      // Check sortOrder was updated correctly
      const entries = repository.getAll();
      const entryMap = new Map(entries.map((e) => [e.id, e]));

      expect(entryMap.get(id3)!.sortOrder).toBe(0);
      expect(entryMap.get(id1)!.sortOrder).toBe(1);
      expect(entryMap.get(id2)!.sortOrder).toBe(2);
    });

    it("should not bump entry version", async () => {
      const id1 = await addTask("Task A");
      const id2 = await addTask("Task B");

      const entriesBefore = repository.getAll();
      const versionsBefore = new Map(entriesBefore.map((e) => [e.id, e.version]));

      await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
        orderedIds: [id2, id1],
      });

      const entriesAfter = repository.getAll();
      for (const entry of entriesAfter) {
        expect(entry.version).toBe(versionsBefore.get(entry.id));
      }
    });

    it("should handle a single entry", async () => {
      const id1 = await addTask("Only one");

      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
        orderedIds: [id1],
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const result = await reorderEntries.execute({
        userId: "",
        date: "2026-01-29",
        orderedIds: ["some-id"],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject invalid date format", async () => {
      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "not-a-date",
        orderedIds: ["some-id"],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty orderedIds array", async () => {
      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
        orderedIds: [],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("non-empty");
      }
    });

    it("should reject duplicate IDs", async () => {
      const id1 = await addTask("Task A");

      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
        orderedIds: [id1, id1],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("duplicates");
      }
    });

    it("should reject IDs that do not belong to user+date", async () => {
      const id1 = await addTask("Task on 29th", "2026-01-29");

      const result = await reorderEntries.execute({
        userId: "user-123",
        date: "2026-01-30",
        orderedIds: [id1],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("does not belong");
      }
    });

    it("should reject IDs from a different user", async () => {
      const id1 = await addTask("Task A");

      const result = await reorderEntries.execute({
        userId: "other-user",
        date: "2026-01-29",
        orderedIds: [id1],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
