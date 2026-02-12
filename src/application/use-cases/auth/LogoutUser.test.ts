import { describe, it, expect, beforeEach } from "vitest";
import { LogoutUser } from "./LogoutUser";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";

describe("LogoutUser", () => {
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let logoutUser: LogoutUser;

  beforeEach(() => {
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
    refreshTokenService = new FakeRefreshTokenService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));
    logoutUser = new LogoutUser(
      refreshTokenRepository,
      refreshTokenService,
      clock,
    );
  });

  it("should revoke specific refresh token when provided", async () => {
    const rawToken = refreshTokenService.generate();
    const tokenHash = refreshTokenService.hashToken(rawToken);
    await refreshTokenRepository.create({
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await logoutUser.execute({
      userId: "user-1",
      refreshTokenRaw: rawToken,
    });

    expect(result.isOk()).toBe(true);
    const tokens = refreshTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].revokedAt).toEqual(clock.now());
  });

  it("should revoke all tokens for user when no token provided", async () => {
    const rawToken1 = refreshTokenService.generate();
    const rawToken2 = refreshTokenService.generate();
    await refreshTokenRepository.create({
      userId: "user-1",
      tokenHash: refreshTokenService.hashToken(rawToken1),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await refreshTokenRepository.create({
      userId: "user-1",
      tokenHash: refreshTokenService.hashToken(rawToken2),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await logoutUser.execute({ userId: "user-1" });

    expect(result.isOk()).toBe(true);
    const tokens = refreshTokenRepository.getAll();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).toEqual(clock.now());
    expect(tokens[1].revokedAt).toEqual(clock.now());
  });

  it("should reject empty userId", async () => {
    const result = await logoutUser.execute({ userId: "" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("userId cannot be empty");
    }
  });
});
