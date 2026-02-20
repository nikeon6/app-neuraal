import { describe, it, expect, beforeEach } from "vitest";
import { VerifyEmail } from "./VerifyEmail";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryEmailVerificationTokenRepository } from "../../test/InMemoryEmailVerificationTokenRepository";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";

const NOW = new Date("2026-02-19T12:00:00Z");

function createUnverifiedUser(repo: InMemoryUserRepository, id = "user-1") {
  const result = User.create({
    id,
    email: "test@example.com",
    passwordHash: "hashed:password",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  if (result.isOk()) repo.create(result.value);
  return result;
}

describe("VerifyEmail", () => {
  let userRepository: InMemoryUserRepository;
  let tokenRepository: InMemoryEmailVerificationTokenRepository;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let verifyEmail: VerifyEmail;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    tokenRepository = new InMemoryEmailVerificationTokenRepository();
    refreshTokenService = new FakeRefreshTokenService();
    clock = new FakeClock(NOW);
    verifyEmail = new VerifyEmail(
      userRepository,
      tokenRepository,
      refreshTokenService,
      clock,
    );
  });

  it("should verify email with valid token", async () => {
    createUnverifiedUser(userRepository);
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });

    const result = await verifyEmail.execute({ token: rawToken });

    expect(result.isOk()).toBe(true);
  });

  it("should mark user as emailVerified=true", async () => {
    createUnverifiedUser(userRepository);
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });

    await verifyEmail.execute({ token: rawToken });

    const user = await userRepository.findById("user-1");
    expect(user?.emailVerified).toBe(true);
  });

  it("should mark token as used", async () => {
    createUnverifiedUser(userRepository);
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });

    await verifyEmail.execute({ token: rawToken });

    const storedToken = await tokenRepository.findByTokenHash(tokenHash);
    expect(storedToken?.usedAt).not.toBeNull();
  });

  it("should reject invalid token", async () => {
    const result = await verifyEmail.execute({
      token: "invalid-token-value-that-does-not-exist-anywhere",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toContain("Invalid");
    }
  });

  it("should reject expired token", async () => {
    createUnverifiedUser(userRepository);
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(NOW.getTime() - 1000),
    });

    const result = await verifyEmail.execute({ token: rawToken });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should reject already-used token", async () => {
    createUnverifiedUser(userRepository);
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });
    await tokenRepository.markUsed(tokenHash, NOW);

    const result = await verifyEmail.execute({ token: rawToken });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should reject token for non-existent user", async () => {
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await tokenRepository.create({
      userId: "non-existent-user",
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });

    const result = await verifyEmail.execute({ token: rawToken });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});
