import { describe, it, expect } from "vitest";
import { ISODate } from "./ISODate";

describe("ISODate", () => {
  describe("create", () => {
    it("should create a valid ISO date from YYYY-MM-DD", () => {
      const result = ISODate.create("2026-01-29");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("2026-01-29");
      }
    });

    it("should accept valid dates", () => {
      const validDates = [
        "2020-01-01",
        "2026-12-31",
        "2025-02-28",
        "2024-02-29", // leap year
        "1999-06-15",
      ];

      for (const date of validDates) {
        const result = ISODate.create(date);
        expect(result.isOk()).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = ISODate.create("");
      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only string", () => {
      const result = ISODate.create("   ");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid format (DD-MM-YYYY)", () => {
      const result = ISODate.create("29-01-2026");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid format (MM/DD/YYYY)", () => {
      const result = ISODate.create("01/29/2026");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid format (YYYY/MM/DD)", () => {
      const result = ISODate.create("2026/01/29");
      expect(result.isErr()).toBe(true);
    });

    it("should reject incomplete date (YYYY-MM)", () => {
      const result = ISODate.create("2026-01");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid month (13)", () => {
      const result = ISODate.create("2026-13-01");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid month (00)", () => {
      const result = ISODate.create("2026-00-01");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid day (32)", () => {
      const result = ISODate.create("2026-01-32");
      expect(result.isErr()).toBe(true);
    });

    it("should reject invalid day (00)", () => {
      const result = ISODate.create("2026-01-00");
      expect(result.isErr()).toBe(true);
    });

    it("should reject Feb 29 on non-leap year", () => {
      const result = ISODate.create("2025-02-29");
      expect(result.isErr()).toBe(true);
    });

    it("should accept Feb 29 on leap year", () => {
      const result = ISODate.create("2024-02-29");
      expect(result.isOk()).toBe(true);
    });

    it("should reject text with extra characters", () => {
      const result = ISODate.create("2026-01-29T00:00:00");
      expect(result.isErr()).toBe(true);
    });

    it("should reject random string", () => {
      const result = ISODate.create("not-a-date");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return the original value", () => {
      const result = ISODate.create("2026-01-29");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("2026-01-29");
      }
    });
  });

  describe("equals", () => {
    it("should return true for same date", () => {
      const date1 = ISODate.create("2026-01-29");
      const date2 = ISODate.create("2026-01-29");

      expect(date1.isOk() && date2.isOk()).toBe(true);
      if (date1.isOk() && date2.isOk()) {
        expect(date1.value.equals(date2.value)).toBe(true);
      }
    });

    it("should return false for different dates", () => {
      const date1 = ISODate.create("2026-01-29");
      const date2 = ISODate.create("2026-01-30");

      expect(date1.isOk() && date2.isOk()).toBe(true);
      if (date1.isOk() && date2.isOk()) {
        expect(date1.value.equals(date2.value)).toBe(false);
      }
    });
  });

  describe("toDate", () => {
    it("should return a Date object for the ISO date", () => {
      const result = ISODate.create("2026-01-29");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const dateObj = result.value.toDate();
        expect(dateObj.getFullYear()).toBe(2026);
        expect(dateObj.getMonth()).toBe(0); // January is 0
        expect(dateObj.getDate()).toBe(29);
      }
    });
  });
});
