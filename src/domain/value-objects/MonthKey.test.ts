import { describe, it, expect } from "vitest";
import { MonthKey } from "./MonthKey";

describe("MonthKey", () => {
  describe("create", () => {
    it("accepts YYYY-MM format", () => {
      const result = MonthKey.create("2026-02");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("2026-02");
      }
    });

    it("rejects invalid format", () => {
      expect(MonthKey.create("2026/02").isErr()).toBe(true);
      expect(MonthKey.create("02-2026").isErr()).toBe(true);
      expect(MonthKey.create("202602").isErr()).toBe(true);
    });

    it("rejects invalid month", () => {
      expect(MonthKey.create("2026-00").isErr()).toBe(true);
      expect(MonthKey.create("2026-13").isErr()).toBe(true);
    });

    it("rejects empty string", () => {
      expect(MonthKey.create("").isErr()).toBe(true);
    });
  });

  describe("fromDate", () => {
    it("returns YYYY-MM for given date", () => {
      const key = MonthKey.fromDate(new Date(2026, 0, 15)); // Jan = 0
      expect(key.toString()).toBe("2026-01");
    });

    it("pads month with zero", () => {
      const key = MonthKey.fromDate(new Date(2025, 8, 1)); // Sep = 8
      expect(key.toString()).toBe("2025-09");
    });
  });
});
