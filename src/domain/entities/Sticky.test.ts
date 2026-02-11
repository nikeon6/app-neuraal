import { describe, it, expect } from "vitest";
import { Sticky, type StickyProps } from "./Sticky";

const validProps: StickyProps = {
  id: "s-1",
  userId: "u-1",
  title: "My Sticky",
  content: { type: "doc", content: [] },
  version: 1,
  sortOrder: 0,
  columnIndex: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("Sticky Entity", () => {
  describe("create", () => {
    it("creates a valid Sticky", () => {
      const result = Sticky.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("s-1");
        expect(result.value.userId).toBe("u-1");
        expect(result.value.title.toString()).toBe("My Sticky");
        expect(result.value.version).toBe(1);
        expect(result.value.columnIndex).toBe(0);
      }
    });

    it("rejects empty id", () => {
      const result = Sticky.create({ ...validProps, id: "" });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error).toContain("id");
    });

    it("rejects empty userId", () => {
      const result = Sticky.create({ ...validProps, userId: " " });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error).toContain("userId");
    });

    it("rejects title over 120 chars", () => {
      const result = Sticky.create({ ...validProps, title: "x".repeat(121) });
      expect(result.isErr()).toBe(true);
    });

    it("rejects version < 1", () => {
      const result = Sticky.create({ ...validProps, version: 0 });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error).toContain("Version");
    });

    it("rejects invalid columnIndex", () => {
      const result = Sticky.create({ ...validProps, columnIndex: 2 });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error).toContain("columnIndex");
    });

    it("defaults columnIndex to 0", () => {
      const result = Sticky.create({ ...validProps, columnIndex: undefined });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.columnIndex).toBe(0);
    });

    it("defaults sortOrder to 0", () => {
      const result = Sticky.create({ ...validProps, sortOrder: undefined });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.sortOrder).toBe(0);
    });
  });

  describe("toJSON", () => {
    it("returns a plain object", () => {
      const result = Sticky.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.id).toBe("s-1");
        expect(json.title).toBe("My Sticky");
        expect(json.columnIndex).toBe(0);
      }
    });
  });

  describe("incrementVersion", () => {
    it("increments version by 1", () => {
      const result = Sticky.create(validProps);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const next = result.value.incrementVersion();
        expect(next.version).toBe(2);
      }
    });
  });

  describe("withUpdates", () => {
    it("updates title", () => {
      const sticky = Sticky.create(validProps).unwrap();
      const updated = sticky.withUpdates({ title: "New Title" });
      expect(updated.isOk()).toBe(true);
      if (updated.isOk()) {
        expect(updated.value.title.toString()).toBe("New Title");
      }
    });

    it("updates columnIndex", () => {
      const sticky = Sticky.create(validProps).unwrap();
      const updated = sticky.withUpdates({ columnIndex: 1 });
      expect(updated.isOk()).toBe(true);
      if (updated.isOk()) {
        expect(updated.value.columnIndex).toBe(1);
      }
    });

    it("rejects invalid columnIndex in update", () => {
      const sticky = Sticky.create(validProps).unwrap();
      const updated = sticky.withUpdates({ columnIndex: 3 });
      expect(updated.isErr()).toBe(true);
    });

    it("rejects title over max length in update", () => {
      const sticky = Sticky.create(validProps).unwrap();
      const updated = sticky.withUpdates({ title: "x".repeat(121) });
      expect(updated.isErr()).toBe(true);
    });
  });
});
