import { describe, it, expect, beforeEach } from "vitest";
import { ListEntriesByDate } from "./ListEntriesByDate";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";

describe("ListEntriesByDate", () => {
  let repository: InMemoryEntryRepository;
  let listEntries: ListEntriesByDate;
  let createEntry: CreateEntry;

  beforeEach(() => {
    repository = new InMemoryEntryRepository();
    listEntries = new ListEntriesByDate(repository);
    createEntry = new CreateEntry(repository);
  });

  async function createTestEntry(
    userId: string,
    date: string,
    title: string,
    type: "task" | "note" = "task",
  ) {
    const result = await createEntry.execute({
      userId,
      date,
      type,
      title,
      content: {},
      completed: type === "task" ? false : undefined,
    });
    if (result.isErr()) throw new Error("Failed to create test entry");
    return result.value;
  }

  describe("successful listing", () => {
    it("should return entries for user on specific date", async () => {
      await createTestEntry("user-123", "2026-01-29", "Task 1");
      await createTestEntry("user-123", "2026-01-29", "Task 2");

      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
      }
    });

    it("should return empty array when no entries", async () => {
      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("should filter by date", async () => {
      await createTestEntry("user-123", "2026-01-29", "Task on 29th");
      await createTestEntry("user-123", "2026-01-30", "Task on 30th");

      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].title).toBe("Task on 29th");
      }
    });

    it("should filter by user", async () => {
      await createTestEntry("user-123", "2026-01-29", "User 123 task");
      await createTestEntry("user-456", "2026-01-29", "User 456 task");

      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].title).toBe("User 123 task");
      }
    });

    it("should return DTOs with all fields", async () => {
      await createTestEntry("user-123", "2026-01-29", "My Task");

      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const dto = result.value[0];
        expect(dto.id).toBeDefined();
        expect(dto.userId).toBe("user-123");
        expect(dto.date).toBe("2026-01-29");
        expect(dto.type).toBe("task");
        expect(dto.title).toBe("My Task");
        expect(dto.content).toBeDefined();
        expect(dto.version).toBe(1);
        expect(dto.createdAt).toBeDefined();
        expect(dto.updatedAt).toBeDefined();
      }
    });

    it("should return both tasks and notes", async () => {
      await createTestEntry("user-123", "2026-01-29", "Task", "task");
      await createTestEntry("user-123", "2026-01-29", "Note", "note");

      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-01-29",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        const types = result.value.map((e) => e.type);
        expect(types).toContain("task");
        expect(types).toContain("note");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const result = await listEntries.execute({
        userId: "",
        date: "2026-01-29",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject whitespace userId", async () => {
      const result = await listEntries.execute({
        userId: "   ",
        date: "2026-01-29",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid date format", async () => {
      const result = await listEntries.execute({
        userId: "user-123",
        date: "29-01-2026",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty date", async () => {
      const result = await listEntries.execute({
        userId: "user-123",
        date: "",
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid date (Feb 30)", async () => {
      const result = await listEntries.execute({
        userId: "user-123",
        date: "2026-02-30",
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
