import { describe, it, expect } from "vitest";
import { User } from "./User";

describe("User", () => {
  const validProps = {
    id: "user-123",
    email: "user@example.com",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
    createdAt: new Date("2026-01-29T10:00:00Z"),
    updatedAt: new Date("2026-01-29T10:00:00Z"),
  };

  describe("create", () => {
    it("should create a valid User", () => {
      const result = User.create(validProps);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("user-123");
        expect(result.value.email.toString()).toBe("user@example.com");
        expect(result.value.passwordHash.toString()).toBe(
          "$2b$10$abcdefghijklmnopqrstuv"
        );
        expect(result.value.createdAt).toEqual(
          new Date("2026-01-29T10:00:00Z")
        );
        expect(result.value.updatedAt).toEqual(
          new Date("2026-01-29T10:00:00Z")
        );
      }
    });

    it("should trim id when creating", () => {
      const result = User.create({ ...validProps, id: "  user-456  " });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("user-456");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty id", () => {
      const result = User.create({ ...validProps, id: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("User id cannot be empty");
      }
    });

    it("should reject whitespace-only id", () => {
      const result = User.create({ ...validProps, id: "   " });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("User id cannot be empty");
      }
    });

    it("should reject invalid email - delegates to Email VO", () => {
      const result = User.create({ ...validProps, email: "invalid-email" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Email");
      }
    });

    it("should reject empty email", () => {
      const result = User.create({ ...validProps, email: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Email");
      }
    });

    it("should reject email without @", () => {
      const result = User.create({ ...validProps, email: "userexample.com" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("@");
      }
    });

    it("should reject empty passwordHash - delegates to PasswordHash VO", () => {
      const result = User.create({ ...validProps, passwordHash: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Password hash");
      }
    });

    it("should reject whitespace-only passwordHash", () => {
      const result = User.create({ ...validProps, passwordHash: "   " });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Password hash");
      }
    });
  });

  describe("toJSON", () => {
    it("should return correct shape with string email and passwordHash", () => {
      const result = User.create(validProps);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json).toEqual({
          id: "user-123",
          email: "user@example.com",
          passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
          createdAt: validProps.createdAt,
          updatedAt: validProps.updatedAt,
        });
      }
    });

    it("should serialize email as lowercase string", () => {
      const result = User.create({
        ...validProps,
        email: "User@Example.COM",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.email).toBe("user@example.com");
      }
    });

    it("should include Date instances for createdAt and updatedAt", () => {
      const result = User.create(validProps);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const json = result.value.toJSON();
        expect(json.createdAt).toBeInstanceOf(Date);
        expect(json.updatedAt).toBeInstanceOf(Date);
      }
    });
  });
});
