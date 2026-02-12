import { describe, it, expect, beforeEach } from "vitest";
import { RefreshSession } from "./RefreshSession";
import { RegisterUser } from "./RegisterUser";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

describe("RefreshSession", () => {
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let jwtService: FakeJwtService;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let registerUser: RegisterUser;
  let refreshSession: RefreshSession;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    jwtService = new FakeJwtService();
    refreshTokenService = new FakeRefreshTokenService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));
    registerUser = new RegisterUser(
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      jwtService,
      refreshTokenService,
      clock,
      900,
      7
    );
    refreshSession = new RefreshSession(
      userRepository,
      refreshTokenRepository,
      jwtService,
      refreshTokenService,
      clock,
      900,
      7
    );
  });

  async function registerAndGetRefreshToken(): Promise<string> {
    const registerResult = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    if (!registerResult.isOk()) throw new Error("Setup failed");
    return registerResult.value.tokens.refreshToken;
  }

  it("should refresh successfully with valid token", async () => {
    const refreshToken = await registerAndGetRefreshToken();

    const result = await refreshSession.execute({ refreshToken });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.user.email).toBe("user@example.com");
      expect(result.value.user.id).toBeDefined();
      expect(result.value.tokens.accessToken).toMatch(/^fake-header\..*\.fake-signature$/);
      expect(result.value.tokens.refreshToken).toBeDefined();
    }
  });

  it("should return new tokens on refresh", async () => {
    const oldRefreshToken = await registerAndGetRefreshToken();

    const result = await refreshSession.execute({ refreshToken: oldRefreshToken });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.tokens.refreshToken).not.toBe(oldRefreshToken);
      expect(result.value.tokens.accessToken).toBeDefined();
    }
  });

  it("should revoke old refresh token on rotation", async () => {
    const oldRefreshToken = await registerAndGetRefreshToken();

    await refreshSession.execute({ refreshToken: oldRefreshToken });

    const tokenHash = refreshTokenService.hashToken(oldRefreshToken);
    const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);
    expect(storedToken).not.toBeNull();
    expect(storedToken!.revokedAt).not.toBeNull();
  });

  it("should reject unknown refresh token", async () => {
    const result = await refreshSession.execute({
      refreshToken: "unknown-token-xxxxxxxxxxxxxxxxxxxx-99",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toContain("Invalid or expired");
    }
  });

  it("should reject revoked refresh token (token reuse attack)", async () => {
    const refreshToken = await registerAndGetRefreshToken();

    await refreshSession.execute({ refreshToken });

    const reuseResult = await refreshSession.execute({ refreshToken });

    expect(reuseResult.isErr()).toBe(true);
    if (reuseResult.isErr()) {
      expect(reuseResult.error.code).toBe("UNAUTHORIZED");
      expect(reuseResult.error.message).toContain("Token reuse detected");
    }
  });

  it("should reject expired refresh token", async () => {
    const refreshToken = await registerAndGetRefreshToken();

    clock.advance(8 * 24 * 60 * 60 * 1000);

    const result = await refreshSession.execute({ refreshToken });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toContain("Invalid or expired");
    }
  });
});
