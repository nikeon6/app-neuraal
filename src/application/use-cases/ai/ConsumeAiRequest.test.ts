import { describe, it, expect } from "vitest";
import { ConsumeAiRequest } from "./ConsumeAiRequest";
import { InMemoryAiUsageRepository } from "../../test/InMemoryAiUsageRepository";
import { FakeClock } from "../../test/FakeClock";
import { MonthKey } from "@/domain/value-objects/MonthKey";

describe("ConsumeAiRequest", () => {
  it("increments monthly requests for known action", async () => {
    const repository = new InMemoryAiUsageRepository();
    const clock = new FakeClock(new Date("2026-02-11T12:00:00.000Z"));
    const useCase = new ConsumeAiRequest(repository, clock);
    const monthKey = MonthKey.fromDate(clock.now()).toString();

    const result = await useCase.execute({
      userId: "user-1",
      action: "SUMMARY",
    });

    expect(result.isOk()).toBe(true);
    const monthly = await repository.getMonthly("user-1", "SUMMARY", monthKey);
    expect(monthly?.requestsUsed).toBe(1);
  });

  it("accumulates request count on repeated calls", async () => {
    const repository = new InMemoryAiUsageRepository();
    const clock = new FakeClock(new Date("2026-02-11T12:00:00.000Z"));
    const useCase = new ConsumeAiRequest(repository, clock);
    const monthKey = MonthKey.fromDate(clock.now()).toString();

    await useCase.execute({ userId: "user-1", action: "SUMMARY" });
    await useCase.execute({ userId: "user-1", action: "SUMMARY" });

    const monthly = await repository.getMonthly("user-1", "SUMMARY", monthKey);
    expect(monthly?.requestsUsed).toBe(2);
  });

  it("is a no-op for unknown action", async () => {
    const repository = new InMemoryAiUsageRepository();
    const clock = new FakeClock(new Date("2026-02-11T12:00:00.000Z"));
    const useCase = new ConsumeAiRequest(repository, clock);
    const monthKey = MonthKey.fromDate(clock.now()).toString();

    const result = await useCase.execute({
      userId: "user-1",
      action: "NOT_A_REAL_ACTION",
    });

    expect(result.isOk()).toBe(true);
    const monthly = await repository.getMonthly(
      "user-1",
      "NOT_A_REAL_ACTION",
      monthKey,
    );
    expect(monthly).toBeNull();
  });
});
