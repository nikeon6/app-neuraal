import { describe, it, expect, beforeEach } from "vitest";
import { ListStickies } from "./ListStickies";
import { CreateSticky } from "./CreateSticky";
import { InMemoryStickyRepository } from "../../test/InMemoryStickyRepository";

describe("ListStickies", () => {
  let repo: InMemoryStickyRepository;
  let listStickies: ListStickies;
  let createSticky: CreateSticky;

  beforeEach(() => {
    repo = new InMemoryStickyRepository();
    listStickies = new ListStickies(repo);
    createSticky = new CreateSticky(repo);
  });

  it("returns empty list when no stickies exist", async () => {
    const result = await listStickies.execute("u-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("returns all stickies for the user", async () => {
    await createSticky.execute({ userId: "u-1", title: "A", content: {} });
    await createSticky.execute({ userId: "u-1", title: "B", content: {} });

    const result = await listStickies.execute("u-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
    }
  });

  it("does not return stickies from other users", async () => {
    await createSticky.execute({ userId: "u-1", title: "Mine", content: {} });
    await createSticky.execute({ userId: "u-2", title: "Theirs", content: {} });

    const result = await listStickies.execute("u-1");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].title).toBe("Mine");
    }
  });
});
