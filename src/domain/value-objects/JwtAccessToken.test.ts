import { describe, it, expect } from "vitest";
import { JwtAccessToken } from "./JwtAccessToken";

describe("JwtAccessToken", () => {
  describe("create", () => {
    it("should create from a valid JWT format", () => {
      const jwt = "eyJhbGc.eyJzdWI.abc123";
      const result = JwtAccessToken.create(jwt);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(jwt);
      }
    });

    it("should accept a real-looking JWT", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const result = JwtAccessToken.create(jwt);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(jwt);
      }
    });

    it("should reject empty string", () => {
      const result = JwtAccessToken.create("");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("empty");
      }
    });

    it("should reject string with no dots", () => {
      const result = JwtAccessToken.create("notajwt");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("exactly 2 dots");
      }
    });

    it("should reject string with one dot", () => {
      const result = JwtAccessToken.create("header.payload");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("exactly 2 dots");
      }
    });

    it("should reject string with more than two dots", () => {
      const result = JwtAccessToken.create("a.b.c.d");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("exactly 2 dots");
      }
    });
  });

  describe("toString", () => {
    it("should return the JWT string", () => {
      const jwt = "eyJhbGc.eyJzdWI.abc123";
      const result = JwtAccessToken.create(jwt);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe(jwt);
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal JWTs", () => {
      const jwt = "eyJhbGc.eyJzdWI.abc123";
      const token1 = JwtAccessToken.create(jwt);
      const token2 = JwtAccessToken.create(jwt);

      expect(token1.isOk() && token2.isOk()).toBe(true);
      if (token1.isOk() && token2.isOk()) {
        expect(token1.value.equals(token2.value)).toBe(true);
      }
    });

    it("should return false for different JWTs", () => {
      const token1 = JwtAccessToken.create("a.b.c");
      const token2 = JwtAccessToken.create("x.y.z");

      expect(token1.isOk() && token2.isOk()).toBe(true);
      if (token1.isOk() && token2.isOk()) {
        expect(token1.value.equals(token2.value)).toBe(false);
      }
    });
  });
});
