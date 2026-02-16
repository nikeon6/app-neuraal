import { describe, it, expect } from "vitest";
import { RefreshTokenValue } from "./RefreshTokenValue";

describe("RefreshTokenValue", () => {
  describe("create", () => {
    it("should create from a valid token (32 chars)", () => {
      const token = "a".repeat(32);
      const result = RefreshTokenValue.create(token);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(token);
      }
    });

    it("should create from a longer token", () => {
      const token = "dGhpcyBpcyBhIGJhc2U2NHVybCBlbmNvZGVkIHRva2VuIHN0cmluZw";
      const result = RefreshTokenValue.create(token);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(token);
      }
    });

    it("should reject empty string", () => {
      const result = RefreshTokenValue.create("");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("empty");
      }
    });

    it("should reject token shorter than 32 characters", () => {
      const result = RefreshTokenValue.create("short");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("32");
      }
    });

    it("should reject token with 31 characters", () => {
      const result = RefreshTokenValue.create("a".repeat(31));

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("32");
      }
    });
  });

  describe("toString", () => {
    it("should return the token string", () => {
      const token = "a".repeat(32);
      const result = RefreshTokenValue.create(token);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(token);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal tokens", () => {
      const token = "a".repeat(32);
      const token1 = RefreshTokenValue.create(token);
      const token2 = RefreshTokenValue.create(token);

      expect(token1.isOk() && token2.isOk()).toBe(true);
      if (token1.isOk() && token2.isOk()) {
        expect(token1.value.equals(token2.value)).toBe(true);
      }
    });

    it("should return false for different tokens", () => {
      const token1 = RefreshTokenValue.create("a".repeat(32));
      const token2 = RefreshTokenValue.create("b".repeat(32));

      expect(token1.isOk() && token2.isOk()).toBe(true);
      if (token1.isOk() && token2.isOk()) {
        expect(token1.value.equals(token2.value)).toBe(false);
      }
    });
  });
});
