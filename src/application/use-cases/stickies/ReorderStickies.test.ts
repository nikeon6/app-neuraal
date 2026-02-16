import { describe, it, expect, beforeEach } from "vitest";
import { ReorderStickies } from "./ReorderStickies";
import { CreateSticky } from "./CreateSticky";
import { InMemoryStickyRepository } from "../../test/InMemoryStickyRepository";

describe("ReorderStickies", () => {
  let repo: InMemoryStickyRepository;
  let createSticky: CreateSticky;
  let reorderStickies: ReorderStickies;

  beforeEach(() => {
    repo = new InMemoryStickyRepository();
    createSticky = new CreateSticky(repo);
    reorderStickies = new ReorderStickies(repo);
  });

  it("accepts valid reorder items", async () => {
    const s1 = (
      await createSticky.execute({ userId: "u-1", title: "A", content: {} })
    ).unwrap();
    const s2 = (
      await createSticky.execute({ userId: "u-1", title: "B", content: {} })
    ).unwrap();

    const result = await reorderStickies.execute("u-1", [
      { id: s2.id, sortOrder: 0, columnIndex: 0 },
      { id: s1.id, sortOrder: 1, columnIndex: 1 },
    ]);

    expect(result.isOk()).toBe(true);
  });

  it("rejects empty items array", async () => {
    const result = await reorderStickies.execute("u-1", []);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid columnIndex", async () => {
    const result = await reorderStickies.execute("u-1", [
      { id: "x", sortOrder: 0, columnIndex: 5 },
    ]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});
