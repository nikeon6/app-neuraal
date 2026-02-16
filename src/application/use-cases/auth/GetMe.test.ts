import { describe, it, expect, beforeEach } from "vitest";
import { GetMe } from "./GetMe";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { User } from "@/domain/entities/User";

describe("GetMe", () => {
  let userRepository: InMemoryUserRepository;
  let getMe: GetMe;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    getMe = new GetMe(userRepository);
  });

  it("should return user DTO for existing user", async () => {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:password",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepository.create(userResult.value);
    }

    const result = await getMe.execute({ userId: "user-1" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("user-1");
      expect(result.value.email).toBe("test@example.com");
    }
  });

  it("should return NOT_FOUND for non-existent user", async () => {
    const result = await getMe.execute({ userId: "non-existent-user" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("User not found");
    }
  });

  it("should reject empty userId", async () => {
    const result = await getMe.execute({ userId: "" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("userId cannot be empty");
    }
  });
});
