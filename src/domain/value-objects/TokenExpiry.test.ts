import { describe, it, expect } from "vitest";
import { TokenExpiry } from "./TokenExpiry";

describe("TokenExpiry", () => {
  describe("create", () => {
    it("should create when expiry is in the future", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const expiresAt = new Date("2025-01-02T12:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toDate().getTime()).toBe(expiresAt.getTime());
      }
    });

    it("should reject when expiry is in the past", () => {
      const now = new Date("2025-01-02T12:00:00Z");
      const expiresAt = new Date("2025-01-01T12:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("future");
      }
    });

    it("should reject when expiry equals now", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const expiresAt = new Date("2025-01-01T12:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("future");
      }
    });

    it("should reject invalid Date", () => {
      const result = TokenExpiry.create(new Date("invalid"), new Date());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("valid Date");
      }
    });
  });

  describe("toDate", () => {
    it("should return the expiry Date", () => {
      const expiresAt = new Date("2025-12-31T23:59:59Z");
      const now = new Date("2025-01-01T00:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toDate()).toEqual(expiresAt);
      }
    });
  });

  describe("isExpired", () => {
    it("should return false when not yet expired", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const expiresAt = new Date("2025-01-02T12:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isExpired(now)).toBe(false);
        expect(result.value.isExpired(new Date("2025-01-01T18:00:00Z"))).toBe(
          false,
        );
      }
    });

    it("should return true when expired", () => {
      const now = new Date("2025-01-01T12:00:00Z");
      const expiresAt = new Date("2025-01-02T12:00:00Z");
      const result = TokenExpiry.create(expiresAt, now);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isExpired(new Date("2025-01-02T12:00:00Z"))).toBe(
          true,
        );
        expect(result.value.isExpired(new Date("2025-01-03T00:00:00Z"))).toBe(
          true,
        );
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal expiry dates", () => {
      const expiresAt = new Date("2025-01-02T12:00:00Z");
      const now = new Date("2025-01-01T00:00:00Z");
      const exp1 = TokenExpiry.create(expiresAt, now);
      const exp2 = TokenExpiry.create(new Date(expiresAt.getTime()), now);

      expect(exp1.isOk() && exp2.isOk()).toBe(true);
      if (exp1.isOk() && exp2.isOk()) {
        expect(exp1.value.equals(exp2.value)).toBe(true);
      }
    });

    it("should return false for different expiry dates", () => {
      const now = new Date("2025-01-01T00:00:00Z");
      const exp1 = TokenExpiry.create(new Date("2025-01-02T12:00:00Z"), now);
      const exp2 = TokenExpiry.create(new Date("2025-01-03T12:00:00Z"), now);

      expect(exp1.isOk() && exp2.isOk()).toBe(true);
      if (exp1.isOk() && exp2.isOk()) {
        expect(exp1.value.equals(exp2.value)).toBe(false);
      }
    });
  });
});
