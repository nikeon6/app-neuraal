import { describe, it, expect } from "vitest";
import { Password } from "./Password";

describe("Password", () => {
  describe("create", () => {
    it("should create a valid password with all requirements", () => {
      const result = Password.create("Pass123!");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("Pass123!");
      }
    });

    it("should accept password with various special chars", () => {
      const validPasswords = ["Pass@123", "Pass#456", "Pass$789", "Ab1!xyzz"];
      for (const pwd of validPasswords) {
        const result = Password.create(pwd);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.toString()).toBe(pwd);
        }
      }
    });

    it("should reject password shorter than 8 characters", () => {
      const result = Password.create("Ab1!xyz");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("8 characters");
      }
    });

    it("should reject password without uppercase", () => {
      const result = Password.create("password123!");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("uppercase");
      }
    });

    it("should reject password without lowercase", () => {
      const result = Password.create("PASSWORD123!");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("lowercase");
      }
    });

    it("should reject password without number", () => {
      const result = Password.create("Password!");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("number");
      }
    });

    it("should reject password without special character", () => {
      const result = Password.create("Password123");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("special character");
      }
    });

    it("should reject password exceeding 128 characters", () => {
      const longPassword = "A".repeat(65) + "a".repeat(64) + "1!";

      expect(longPassword.length).toBeGreaterThan(128);
      const result = Password.create(longPassword);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("128");
      }
    });
  });

  describe("toString", () => {
    it("should return the raw password string", () => {
      const pwd = "MyP@ssw0rd";
      const result = Password.create(pwd);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(pwd);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal passwords", () => {
      const pwd1 = Password.create("Pass123!");
      const pwd2 = Password.create("Pass123!");

      expect(pwd1.isOk() && pwd2.isOk()).toBe(true);
      if (pwd1.isOk() && pwd2.isOk()) {
        expect(pwd1.value.equals(pwd2.value)).toBe(true);
      }
    });

    it("should return false for different passwords", () => {
      const pwd1 = Password.create("Pass123!");
      const pwd2 = Password.create("Pass456!");

      expect(pwd1.isOk() && pwd2.isOk()).toBe(true);
      if (pwd1.isOk() && pwd2.isOk()) {
        expect(pwd1.value.equals(pwd2.value)).toBe(false);
      }
    });
  });
});
