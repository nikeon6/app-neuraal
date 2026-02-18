import { describe, it, expect, beforeEach } from "vitest";
import { ConfirmPasswordReset } from "./ConfirmPasswordReset";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryPasswordResetTokenRepository } from "../../test/InMemoryPasswordResetTokenRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";

const VALID_PASSWORD = "NewSecurePass1!";
const NOW = new Date("2026-02-18T12:00:00Z");

describe("ConfirmPasswordReset", () => {
  let userRepo: InMemoryUserRepository;
  let resetTokenRepo: InMemoryPasswordResetTokenRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let hasher: FakePasswordHasher;
  let tokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let useCase: ConfirmPasswordReset;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    resetTokenRepo = new InMemoryPasswordResetTokenRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    hasher = new FakePasswordHasher();
    tokenService = new FakeRefreshTokenService();
    clock = new FakeClock(NOW);
    useCase = new ConfirmPasswordReset(
      userRepo,
      resetTokenRepo,
      refreshTokenRepo,
      hasher,
      tokenService,
      clock,
    );
  });

  async function seedUserAndToken(options?: {
    expiresAt?: Date;
    usedAt?: Date | null;
  }) {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:OldPassword1!",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepo.create(userResult.value);
    }

    const rawToken = tokenService.generate();
    const tokenHash = tokenService.hashToken(rawToken);
    const expiresAt =
      options?.expiresAt ?? new Date(NOW.getTime() + 30 * 60 * 1000);

    await resetTokenRepo.create({ userId: "user-1", tokenHash, expiresAt });

    if (options?.usedAt) {
      await resetTokenRepo.markUsed(tokenHash, options.usedAt);
    }

    return { rawToken, tokenHash };
  }

  it("should reset password with valid token", async () => {
    const { rawToken } = await seedUserAndToken();

    const result = await useCase.execute({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);

    const user = await userRepo.findById("user-1");
    expect(user!.passwordHash.toString()).toBe(`hashed:${VALID_PASSWORD}`);
  });

  it("should mark the token as used", async () => {
    const { rawToken, tokenHash } = await seedUserAndToken();

    await useCase.execute({ token: rawToken, newPassword: VALID_PASSWORD });

    const token = await resetTokenRepo.findByTokenHash(tokenHash);
    expect(token!.usedAt).toEqual(NOW);
  });

  it("should revoke all refresh tokens for the user", async () => {
    const { rawToken } = await seedUserAndToken();

    await refreshTokenRepo.create({
      userId: "user-1",
      tokenHash: "session-1",
      expiresAt: new Date(NOW.getTime() + 86400000),
    });
    await refreshTokenRepo.create({
      userId: "user-1",
      tokenHash: "session-2",
      expiresAt: new Date(NOW.getTime() + 86400000),
    });

    await useCase.execute({ token: rawToken, newPassword: VALID_PASSWORD });

    const allTokens = refreshTokenRepo.getAll();
    expect(allTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it("should reject weak password", async () => {
    const { rawToken } = await seedUserAndToken();

    const result = await useCase.execute({
      token: rawToken,
      newPassword: "weak",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject invalid token", async () => {
    const result = await useCase.execute({
      token: "nonexistent-token-xxxxxxxxxxxxxxxxxx",
      newPassword: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toBe("Invalid or expired reset token");
    }
  });

  it("should reject expired token", async () => {
    const { rawToken } = await seedUserAndToken({
      expiresAt: new Date(NOW.getTime() - 1000),
    });

    const result = await useCase.execute({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should reject already-used token", async () => {
    const { rawToken } = await seedUserAndToken({
      usedAt: new Date(NOW.getTime() - 60000),
    });

    const result = await useCase.execute({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});
