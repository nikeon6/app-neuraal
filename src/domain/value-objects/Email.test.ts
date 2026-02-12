import { describe, it, expect } from "vitest";
import { Email } from "./Email";

describe("Email", () => {
  describe("create", () => {
    it("should create a valid Email", () => {
      const result = Email.create("user@example.com");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("user@example.com");
      }
    });

    it("should normalize to lowercase", () => {
      const result = Email.create("User@Example.COM");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("user@example.com");
      }
    });

    it("should trim whitespace", () => {
      const result = Email.create("  user@example.com  ");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("user@example.com");
      }
    });

    it("should reject empty string", () => {
      const result = Email.create("");

      expect(result.isErr()).toBe(true);
    });

    it("should reject whitespace-only string", () => {
      const result = Email.create("   ");

      expect(result.isErr()).toBe(true);
    });

    it("should reject email without @", () => {
      const result = Email.create("userexample.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("exactly one @");
      }
    });

    it("should reject email with multiple @", () => {
      const result = Email.create("user@exam@ple.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("exactly one @");
      }
    });

    it("should reject email with empty local part", () => {
      const result = Email.create("@example.com");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("non-empty local part");
      }
    });

    it("should reject email with empty domain part", () => {
      const result = Email.create("user@");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("non-empty domain part");
      }
    });

    it("should reject domain without dot", () => {
      const result = Email.create("user@example");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("at least one .");
      }
    });

    it("should reject email exceeding 254 characters", () => {
      const longLocal = "a".repeat(250);
      const result = Email.create(`${longLocal}@ab.co`);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("254");
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal emails", () => {
      const email1 = Email.create("user@example.com");
      const email2 = Email.create("user@example.com");

      expect(email1.isOk() && email2.isOk()).toBe(true);
      if (email1.isOk() && email2.isOk()) {
        expect(email1.value.equals(email2.value)).toBe(true);
      }
    });

    it("should return true for same email in different cases", () => {
      const email1 = Email.create("User@Example.com");
      const email2 = Email.create("user@example.com");

      expect(email1.isOk() && email2.isOk()).toBe(true);
      if (email1.isOk() && email2.isOk()) {
        expect(email1.value.equals(email2.value)).toBe(true);
      }
    });

    it("should return false for different emails", () => {
      const email1 = Email.create("user@example.com");
      const email2 = Email.create("other@example.com");

      expect(email1.isOk() && email2.isOk()).toBe(true);
      if (email1.isOk() && email2.isOk()) {
        expect(email1.value.equals(email2.value)).toBe(false);
      }
    });
  });
});
