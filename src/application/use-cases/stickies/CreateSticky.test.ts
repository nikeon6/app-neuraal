import { describe, it, expect, beforeEach } from "vitest";
import { CreateSticky } from "./CreateSticky";
import { InMemoryStickyRepository } from "../../test/InMemoryStickyRepository";

describe("CreateSticky", () => {
  let repo: InMemoryStickyRepository;
  let useCase: CreateSticky;

  beforeEach(() => {
    repo = new InMemoryStickyRepository();
    useCase = new CreateSticky(repo);
  });

  it("creates a sticky with valid input", async () => {
    const result = await useCase.execute({
      userId: "u-1",
      title: "My Sticky",
      content: { type: "doc", content: [] },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe("My Sticky");
      expect(result.value.version).toBe(1);
      expect(result.value.columnIndex).toBe(0);
    }
  });

  it("persists the sticky in repository", async () => {
    const result = await useCase.execute({
      userId: "u-1",
      title: "Persisted",
      content: {},
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const found = await repo.findById(result.value.id);
      expect(found).not.toBeNull();
    }
  });

  it("assigns columnIndex when specified", async () => {
    const result = await useCase.execute({
      userId: "u-1",
      title: "Right Column",
      content: {},
      columnIndex: 1,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.columnIndex).toBe(1);
    }
  });

  it("generates unique ids", async () => {
    const r1 = await useCase.execute({ userId: "u-1", title: "A", content: {} });
    const r2 = await useCase.execute({ userId: "u-1", title: "B", content: {} });

    expect(r1.isOk() && r2.isOk()).toBe(true);
    if (r1.isOk() && r2.isOk()) {
      expect(r1.value.id).not.toBe(r2.value.id);
    }
  });

  it("rejects empty userId", async () => {
    const result = await useCase.execute({ userId: "", title: "X", content: {} });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects title over 120 chars", async () => {
    const result = await useCase.execute({
      userId: "u-1",
      title: "x".repeat(121),
      content: {},
    });
    expect(result.isErr()).toBe(true);
  });
});
