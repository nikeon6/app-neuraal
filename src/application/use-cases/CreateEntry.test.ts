import { describe, it, expect, beforeEach } from "vitest";
import { CreateEntry } from "./CreateEntry";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";

describe("CreateEntry", () => {
  let repository: InMemoryEntryRepository;
  let createEntry: CreateEntry;

  beforeEach(() => {
    repository = new InMemoryEntryRepository();
    createEntry = new CreateEntry(repository);
  });

  describe("successful creation", () => {
    it("should create a task entry", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: { text: "Task content" },
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe("task");
        expect(result.value.title).toBe("My Task");
        expect(result.value.completed).toBe(false);
        expect(result.value.version).toBe(1);
      }
    });

    it("should create a note entry", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "note",
        title: "My Note",
        content: { text: "Note content" },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe("note");
        expect(result.value.completed).toBeNull();
      }
    });

    it("should generate unique id", async () => {
      const result1 = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "Task 1",
        content: {},
        completed: false,
      });

      const result2 = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "Task 2",
        content: {},
        completed: false,
      });

      expect(result1.isOk() && result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.id).not.toBe(result2.value.id);
      }
    });

    it("should create entry with topicId", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        topicId: "topic-456",
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.topicId).toBe("topic-456");
      }
    });

    it("should create entry with null topicId", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        topicId: null,
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.topicId).toBeNull();
      }
    });

    it("should persist entry", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const found = await repository.findById(result.value.id);
        expect(found).not.toBeNull();
      }
    });

    it("should trim title", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "  My Task  ",
        content: {},
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("My Task");
      }
    });

    it("should allow empty title", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "",
        content: {},
        completed: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe("");
      }
    });

    it("should set createdAt and updatedAt", async () => {
      const before = new Date();

      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      const after = new Date();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const createdAt = new Date(result.value.createdAt);
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty userId", async () => {
      const result = await createEntry.execute({
        userId: "",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject invalid date format", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "29-01-2026",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject invalid date (Feb 30)", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-02-30",
        type: "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid type", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "event" as "task",
        title: "My Task",
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject title too long", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "a".repeat(121),
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject non-object content", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: "string" as unknown as Record<string, unknown>,
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject null content", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "task",
        title: "My Task",
        content: null as unknown as Record<string, unknown>,
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });

    it("should reject completed on note", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "note",
        title: "My Note",
        content: {},
        completed: true,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("completed");
      }
    });

    it("should reject completed=false on note", async () => {
      const result = await createEntry.execute({
        userId: "user-123",
        date: "2026-01-29",
        type: "note",
        title: "My Note",
        content: {},
        completed: false,
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
