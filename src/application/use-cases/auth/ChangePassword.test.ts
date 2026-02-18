import { describe, it, expect, beforeEach } from "vitest";
import { ChangePassword } from "./ChangePassword";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";

const CURRENT_PASSWORD = "OldPassword1!";
const NEW_PASSWORD = "NewSecurePass1!";
const NOW = new Date("2026-02-18T12:00:00Z");

describe("ChangePassword", () => {
  let userRepo: InMemoryUserRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let hasher: FakePasswordHasher;
  let clock: FakeClock;
  let useCase: ChangePassword;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    hasher = new FakePasswordHasher();
    clock = new FakeClock(NOW);
    useCase = new ChangePassword(userRepo, refreshTokenRepo, hasher, clock);
  });

  async function seedUser() {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: `hashed:${CURRENT_PASSWORD}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepo.create(userResult.value);
    }
  }

  it("should change password with valid current password", async () => {
    await seedUser();

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result.isOk()).toBe(true);

    const user = await userRepo.findById("user-1");
    expect(user!.passwordHash.toString()).toBe(`hashed:${NEW_PASSWORD}`);
  });

  it("should revoke all refresh tokens after password change", async () => {
    await seedUser();

    await refreshTokenRepo.create({
      userId: "user-1",
      tokenHash: "session-1",
      expiresAt: new Date(NOW.getTime() + 86400000),
    });

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result.isOk()).toBe(true);

    const allTokens = refreshTokenRepo.getAll();
    expect(allTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it("should reject wrong current password", async () => {
    await seedUser();

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: "WrongPassword1!",
      newPassword: NEW_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toBe("Current password is incorrect");
    }
  });

  it("should reject weak new password", async () => {
    await seedUser();

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: CURRENT_PASSWORD,
      newPassword: "weak",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject non-existent user", async () => {
    const result = await useCase.execute({
      userId: "nonexistent",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should reject empty userId", async () => {
    const result = await useCase.execute({
      userId: "",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
