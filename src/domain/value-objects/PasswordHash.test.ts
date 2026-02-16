import { describe, it, expect } from "vitest";
import { PasswordHash } from "./PasswordHash";

describe("PasswordHash", () => {
  describe("create", () => {
    it("should create from a valid bcrypt hash", () => {
      const hash =
        "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
      const result = PasswordHash.create(hash);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(hash);
      }
    });

    it("should accept any non-empty string", () => {
      const hash = "any-hash-like-string";
      const result = PasswordHash.create(hash);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(hash);
      }
    });

    it("should reject empty string", () => {
      const result = PasswordHash.create("");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("empty");
      }
    });

    it("should reject whitespace-only string", () => {
      const result = PasswordHash.create("   ");

      expect(result.isErr()).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return the hash string", () => {
      const hash = "$2b$10$abc123";
      const result = PasswordHash.create(hash);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(hash);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal hashes", () => {
      const hash = "$2b$10$N9qo8uLOickgx2ZMRZoMye";
      const hash1 = PasswordHash.create(hash);
      const hash2 = PasswordHash.create(hash);

      expect(hash1.isOk() && hash2.isOk()).toBe(true);
      if (hash1.isOk() && hash2.isOk()) {
        expect(hash1.value.equals(hash2.value)).toBe(true);
      }
    });

    it("should return false for different hashes", () => {
      const hash1 = PasswordHash.create("$2b$10$hash1");
      const hash2 = PasswordHash.create("$2b$10$hash2");

      expect(hash1.isOk() && hash2.isOk()).toBe(true);
      if (hash1.isOk() && hash2.isOk()) {
        expect(hash1.value.equals(hash2.value)).toBe(false);
      }
    });
  });
});
