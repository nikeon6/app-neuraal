import { describe, it, expect, beforeEach } from "vitest";
import { DeleteSticky } from "./DeleteSticky";
import { CreateSticky } from "./CreateSticky";
import { InMemoryStickyRepository } from "../../test/InMemoryStickyRepository";

describe("DeleteSticky", () => {
  let repo: InMemoryStickyRepository;
  let createSticky: CreateSticky;
  let deleteSticky: DeleteSticky;

  beforeEach(() => {
    repo = new InMemoryStickyRepository();
    createSticky = new CreateSticky(repo);
    deleteSticky = new DeleteSticky(repo);
  });

  it("deletes an existing sticky", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "S", content: {} })
    ).unwrap();

    const result = await deleteSticky.execute(created.id, "u-1");
    expect(result.isOk()).toBe(true);

    const found = await repo.findById(created.id);
    expect(found).toBeNull();
  });

  it("returns not found for non-existent sticky", async () => {
    const result = await deleteSticky.execute("nope", "u-1");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns not found when userId does not match", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "S", content: {} })
    ).unwrap();

    const result = await deleteSticky.execute(created.id, "u-other");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("NOT_FOUND");
  });
});
