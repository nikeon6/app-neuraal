import { describe, it, expect, beforeEach } from "vitest";
import { UpdateSticky } from "./UpdateSticky";
import { CreateSticky } from "./CreateSticky";
import { InMemoryStickyRepository } from "../../test/InMemoryStickyRepository";

describe("UpdateSticky", () => {
  let repo: InMemoryStickyRepository;
  let createSticky: CreateSticky;
  let updateSticky: UpdateSticky;

  beforeEach(() => {
    repo = new InMemoryStickyRepository();
    createSticky = new CreateSticky(repo);
    updateSticky = new UpdateSticky(repo);
  });

  it("updates title", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "Old", content: {} })
    ).unwrap();

    const result = await updateSticky.execute(created.id, "u-1", {
      version: 1,
      title: "New Title",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe("New Title");
      expect(result.value.version).toBe(2);
    }
  });

  it("updates content", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "S", content: {} })
    ).unwrap();

    const result = await updateSticky.execute(created.id, "u-1", {
      version: 1,
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.content).toHaveProperty("type", "doc");
    }
  });

  it("returns not found for non-existent sticky", async () => {
    const result = await updateSticky.execute("nope", "u-1", {
      version: 1,
      title: "X",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns not found when userId does not match", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "S", content: {} })
    ).unwrap();

    const result = await updateSticky.execute(created.id, "u-other", {
      version: 1,
      title: "X",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns conflict on version mismatch", async () => {
    const created = (
      await createSticky.execute({ userId: "u-1", title: "S", content: {} })
    ).unwrap();

    const result = await updateSticky.execute(created.id, "u-1", {
      version: 99,
      title: "X",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("CONFLICT");
  });
});
