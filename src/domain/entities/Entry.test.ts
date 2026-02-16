import { describe, it, expect } from "vitest";
import { Entry } from "./Entry";

describe("Entry", () => {
  const validTaskProps = {
    id: "entry-123",
    userId: "user-456",
    date: "2026-01-29",
    type: "task" as const,
    title: "My Task",
    content: { text: "Hello" },
    topicId: "topic-789",
    completed: false,
    version: 1,
    createdAt: new Date("2026-01-29T10:00:00Z"),
    updatedAt: new Date("2026-01-29T10:00:00Z"),
  };

  const validNoteProps = {
    id: "entry-456",
    userId: "user-456",
    date: "2026-01-29",
    type: "note" as const,
    title: "My Note",
    content: { text: "Note content" },
    topicId: null,
    completed: null,
    version: 1,
    createdAt: new Date("2026-01-29T10:00:00Z"),
    updatedAt: new Date("2026-01-29T10:00:00Z"),
  };

  describe("create - Task", () => {
    it("should create a valid task entry", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("entry-123");
        expect(result.value.userId).toBe("user-456");
        expect(result.value.date.toString()).toBe("2026-01-29");
        expect(result.value.type.isTask()).toBe(true);
        expect(result.value.title.toString()).toBe("My Task");
        expect(result.value.topicId).toBe("topic-789");
        expect(result.value.completed).toBe(false);
        expect(result.value.version).toBe(1);
      }
    });

    it("should create task with completed=true", () => {
      const result = Entry.create({ ...validTaskProps, completed: true });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.completed).toBe(true);
      }
    });

    it("should create task with null topicId", () => {
      const result = Entry.create({ ...validTaskProps, topicId: null });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.topicId).toBeNull();
      }
    });

    it("should create task with empty title", () => {
      const result = Entry.create({ ...validTaskProps, title: "" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title.isEmpty()).toBe(true);
      }
    });
  });

  describe("create - Note", () => {
    it("should create a valid note entry", () => {
      const result = Entry.create(validNoteProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type.isNote()).toBe(true);
        expect(result.value.completed).toBeNull();
      }
    });

    it("should reject note with completed=true", () => {
      const result = Entry.create({
        ...validNoteProps,
        completed: true,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("completed");
        expect(result.error).toContain("note");
      }
    });

    it("should reject note with completed=false", () => {
      const result = Entry.create({
        ...validNoteProps,
        completed: false,
      });
      expect(result.isErr()).toBe(true);
    });

    it("should accept note with completed=null", () => {
      const result = Entry.create({
        ...validNoteProps,
        completed: null,
      });
      expect(result.isOk()).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should reject empty id", () => {
      const result = Entry.create({ ...validTaskProps, id: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only id", () => {
      const result = Entry.create({ ...validTaskProps, id: "   " });
      expect(result.isErr()).toBe(true);
    });

    it("should reject empty userId", () => {
      const result = Entry.create({ ...validTaskProps, userId: "" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = Entry.create({ ...validTaskProps, date: "29-01-2026" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid date (Feb 30)", () => {
      const result = Entry.create({ ...validTaskProps, date: "2026-02-30" });
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid type", () => {
      const result = Entry.create({
        ...validTaskProps,
        type: "event" as "task",
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject title too long", () => {
      const result = Entry.create({
        ...validTaskProps,
        title: "a".repeat(121),
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject non-object content", () => {
      const result = Entry.create({
        ...validTaskProps,
        content: "string" as unknown as Record<string, unknown>,
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject null content", () => {
      const result = Entry.create({
        ...validTaskProps,
        content: null as unknown as Record<string, unknown>,
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject array content", () => {
      const result = Entry.create({
        ...validTaskProps,
        content: [] as unknown as Record<string, unknown>,
      });
      expect(result.isErr()).toBe(true);
    });

    it("should reject version less than 1", () => {
      const result = Entry.create({ ...validTaskProps, version: 0 });
      expect(result.isErr()).toBe(true);
    });

    it("should reject negative version", () => {
      const result = Entry.create({ ...validTaskProps, version: -1 });
      expect(result.isErr()).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("should return a plain object representation", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.id).toBe("entry-123");
        expect(json.userId).toBe("user-456");
        expect(json.date).toBe("2026-01-29");
        expect(json.type).toBe("task");
        expect(json.title).toBe("My Task");
        expect(json.content).toEqual({ text: "Hello" });
        expect(json.topicId).toBe("topic-789");
        expect(json.completed).toBe(false);
        expect(json.version).toBe(1);
        expect(json.createdAt).toBeInstanceOf(Date);
        expect(json.updatedAt).toBeInstanceOf(Date);
      }
    });

    it("should serialize note with completed=null", () => {
      const result = Entry.create(validNoteProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.completed).toBeNull();
      }
    });
  });

  describe("incrementVersion", () => {
    it("should create new entry with incremented version", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updated = result.value.incrementVersion();
        expect(updated.version).toBe(2);
        expect(result.value.version).toBe(1); // Original unchanged
      }
    });
  });

  describe("withUpdates", () => {
    it("should update title", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({
          title: "Updated Title",
        });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.title.toString()).toBe("Updated Title");
        }
      }
    });

    it("should update content", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({
          content: { newContent: true },
        });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.content.toJSON()).toEqual({
            newContent: true,
          });
        }
      }
    });

    it("should update topicId", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ topicId: "new-topic" });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.topicId).toBe("new-topic");
        }
      }
    });

    it("should update topicId to null", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ topicId: null });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.topicId).toBeNull();
        }
      }
    });

    it("should update completed on task", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ completed: true });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.completed).toBe(true);
        }
      }
    });

    it("should ignore completed update on note (reset to null)", () => {
      const result = Entry.create(validNoteProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ completed: true });
        // Notes silently reset completed to null (not an error)
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.completed).toBeNull();
        }
      }
    });

    it("should allow changing type from task to note (resets completed)", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ type: "note" });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.type.toString()).toBe("note");
          expect(updateResult.value.completed).toBeNull();
        }
      }
    });

    it("should allow changing type from note to task", () => {
      const result = Entry.create(validNoteProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({ type: "task" });
        expect(updateResult.isOk()).toBe(true);
        if (updateResult.isOk()) {
          expect(updateResult.value.type.toString()).toBe("task");
        }
      }
    });

    it("should not change original entry", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        result.value.withUpdates({ title: "Updated Title" });
        expect(result.value.title.toString()).toBe("My Task");
      }
    });

    it("should reject invalid title update", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({
          title: "a".repeat(121),
        });
        expect(updateResult.isErr()).toBe(true);
      }
    });

    it("should reject invalid content update", () => {
      const result = Entry.create(validTaskProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const updateResult = result.value.withUpdates({
          content: "string" as unknown as Record<string, unknown>,
        });
        expect(updateResult.isErr()).toBe(true);
      }
    });
  });
});
