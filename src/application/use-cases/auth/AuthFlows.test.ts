import { describe, it, expect, beforeEach } from "vitest";
import { RegisterUser } from "./RegisterUser";
import { LoginUser } from "./LoginUser";
import { RefreshSession } from "./RefreshSession";
import { LogoutUser } from "./LogoutUser";
import { GetMe } from "./GetMe";
import { RequestPasswordReset } from "./RequestPasswordReset";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { InMemoryPasswordResetTokenRepository } from "../../test/InMemoryPasswordResetTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";

const ACCESS_TTL = 900;
const REFRESH_TTL_DAYS = 30;
const RESET_TTL_MINUTES = 30;

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

let userRepo: InMemoryUserRepository;
let refreshTokenRepo: InMemoryRefreshTokenRepository;
let resetTokenRepo: InMemoryPasswordResetTokenRepository;
let hasher: FakePasswordHasher;
let jwtService: FakeJwtService;
let tokenService: FakeRefreshTokenService;
let clock: FakeClock;
let register: RegisterUser;
let loginUC: LoginUser;
let refresh: RefreshSession;
let logoutUC: LogoutUser;
let getMe: GetMe;
let recover: RequestPasswordReset;

describe("AuthFlows (integration)", () => {
  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    resetTokenRepo = new InMemoryPasswordResetTokenRepository();
    hasher = new FakePasswordHasher();
    jwtService = new FakeJwtService();
    tokenService = new FakeRefreshTokenService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));

    register = new RegisterUser(
      userRepo,
      refreshTokenRepo,
      hasher,
      jwtService,
      tokenService,
      clock,
      ACCESS_TTL,
      REFRESH_TTL_DAYS
    );

    loginUC = new LoginUser(
      userRepo,
      refreshTokenRepo,
      hasher,
      jwtService,
      tokenService,
      clock,
      ACCESS_TTL,
      REFRESH_TTL_DAYS
    );

    refresh = new RefreshSession(
      userRepo,
      refreshTokenRepo,
      jwtService,
      tokenService,
      clock,
      ACCESS_TTL,
      REFRESH_TTL_DAYS
    );

    logoutUC = new LogoutUser(refreshTokenRepo, tokenService, clock);

    getMe = new GetMe(userRepo);

    recover = new RequestPasswordReset(
      userRepo,
      resetTokenRepo,
      tokenService,
      clock,
      RESET_TTL_MINUTES
    );
  });

  describe("1. Full registration + login + me + logout flow", () => {
    it("registers user, logs in, gets me, logs out and revokes all tokens", async () => {
      // Register
      const regResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(regResult.isOk()).toBe(true);
      if (!regResult.isOk()) return;

      // Verify user is created in repo
      expect(userRepo.getAll()).toHaveLength(1);
      expect(userRepo.getAll()[0].email.toString()).toBe(VALID_EMAIL);

      // Login with same credentials
      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(loginResult.isOk()).toBe(true);
      if (!loginResult.isOk()) return;

      const { user: loginUser, tokens: loginTokens } = loginResult.value;

      // Verify JWT from login is valid
      const payload = await jwtService.verify(loginTokens.accessToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(loginUser.id);
      expect(payload!.email).toBe(VALID_EMAIL);

      // GetMe with the user ID
      const meResult = await getMe.execute({ userId: loginUser.id });
      expect(meResult.isOk()).toBe(true);
      if (!meResult.isOk()) return;
      expect(meResult.value.id).toBe(loginUser.id);
      expect(meResult.value.email).toBe(VALID_EMAIL);

      // Logout (revoke all tokens for user)
      const logoutResult = await logoutUC.execute({ userId: loginUser.id });
      expect(logoutResult.isOk()).toBe(true);

      // Verify all refresh tokens for user are revoked
      const allTokens = refreshTokenRepo.getAll();
      const userTokens = allTokens.filter((t) => t.userId === loginUser.id);
      expect(userTokens.length).toBeGreaterThan(0);
      expect(userTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });
  });

  describe("2. Register then login with wrong password", () => {
    it("fails login with UNAUTHORIZED when password is wrong", async () => {
      await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: "WrongPassword123!",
      });

      expect(loginResult.isErr()).toBe(true);
      if (loginResult.isErr()) {
        expect(loginResult.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("3. Refresh token rotation", () => {
    it("rotates token on refresh, old token revoked, new works, old replay fails", async () => {
      const regResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(regResult.isOk()).toBe(true);
      if (!regResult.isOk()) return;

      const originalRefreshToken = regResult.value.tokens.refreshToken;

      // Refresh once -> get new tokens
      const refresh1Result = await refresh.execute({ refreshToken: originalRefreshToken });
      expect(refresh1Result.isOk()).toBe(true);
      if (!refresh1Result.isOk()) return;

      const newRefreshToken = refresh1Result.value.tokens.refreshToken;
      expect(newRefreshToken).not.toBe(originalRefreshToken);

      // Old refresh token should be revoked
      const oldTokenHash = tokenService.hashToken(originalRefreshToken);
      const oldStored = await refreshTokenRepo.findByTokenHash(oldTokenHash);
      expect(oldStored).not.toBeNull();
      expect(oldStored!.revokedAt).not.toBeNull();

      // New refresh token should work for another refresh
      const refresh2Result = await refresh.execute({ refreshToken: newRefreshToken });
      expect(refresh2Result.isOk()).toBe(true);

      // Using OLD refresh token again should fail (reuse detection)
      const replayResult = await refresh.execute({ refreshToken: originalRefreshToken });
      expect(replayResult.isErr()).toBe(true);
      if (replayResult.isErr()) {
        expect(replayResult.error.code).toBe("UNAUTHORIZED");
        expect(replayResult.error.message).toContain("Token reuse detected");
      }
    });
  });

  describe("4. Double refresh with same token (replay attack)", () => {
    it("refreshing with revoked token returns UNAUTHORIZED", async () => {
      const regResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(regResult.isOk()).toBe(true);
      if (!regResult.isOk()) return;

      const originalRefreshToken = regResult.value.tokens.refreshToken;

      // Refresh once (success)
      const firstRefresh = await refresh.execute({ refreshToken: originalRefreshToken });
      expect(firstRefresh.isOk()).toBe(true);

      // Try refreshing with original (now revoked) token again
      const secondRefresh = await refresh.execute({ refreshToken: originalRefreshToken });
      expect(secondRefresh.isErr()).toBe(true);
      if (secondRefresh.isErr()) {
        expect(secondRefresh.error.code).toBe("UNAUTHORIZED");
        expect(secondRefresh.error.message).toContain("Token reuse detected");
      }
    });
  });

  describe("5. Logout revokes all tokens", () => {
    it("logout without token revokes all refresh tokens for user", async () => {
      const regResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(regResult.isOk()).toBe(true);
      if (!regResult.isOk()) return;

      const userId = regResult.value.user.id;
      const token1 = regResult.value.tokens.refreshToken;

      const login2Result = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(login2Result.isOk()).toBe(true);
      if (!login2Result.isOk()) return;
      const token2 = login2Result.value.tokens.refreshToken;

      const login3Result = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(login3Result.isOk()).toBe(true);
      if (!login3Result.isOk()) return;
      const token3 = login3Result.value.tokens.refreshToken;

      // Logout without specific token
      const logoutResult = await logoutUC.execute({ userId });
      expect(logoutResult.isOk()).toBe(true);

      // Refreshing with any token fails
      const refresh1 = await refresh.execute({ refreshToken: token1 });
      const refresh2 = await refresh.execute({ refreshToken: token2 });
      const refresh3 = await refresh.execute({ refreshToken: token3 });

      expect(refresh1.isErr()).toBe(true);
      expect(refresh2.isErr()).toBe(true);
      expect(refresh3.isErr()).toBe(true);

      const allTokens = refreshTokenRepo.getAll().filter((t) => t.userId === userId);
      expect(allTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });
  });

  describe("6. Password recover always returns ok", () => {
    it("existing email creates reset token, non-existing does not", async () => {
      // Recover with non-existing email -> ok, no token created
      const recover1Result = await recover.execute({ email: "nonexistent@example.com" });
      expect(recover1Result.isOk()).toBe(true);
      expect(resetTokenRepo.getAll()).toHaveLength(0);

      // Register user
      await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });

      // Recover with existing email -> ok, token created
      const recover2Result = await recover.execute({ email: VALID_EMAIL });
      expect(recover2Result.isOk()).toBe(true);
      expect(resetTokenRepo.getAll()).toHaveLength(1);
      expect(resetTokenRepo.getAll()[0].userId).toBe(userRepo.getAll()[0].id);
    });
  });

  describe("7. Expired refresh token is rejected", () => {
    it("refresh fails when token is past expiry", async () => {
      const regResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(regResult.isOk()).toBe(true);
      if (!regResult.isOk()) return;

      const originalRefreshToken = regResult.value.tokens.refreshToken;

      // Advance clock past refresh expiry (31 days)
      const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
      clock.advance(thirtyOneDays);

      const refreshResult = await refresh.execute({ refreshToken: originalRefreshToken });

      expect(refreshResult.isErr()).toBe(true);
      if (refreshResult.isErr()) {
        expect(refreshResult.error.code).toBe("UNAUTHORIZED");
        expect(refreshResult.error.message).toContain("Invalid or expired");
      }
    });
  });

  describe("8. Register with duplicate email", () => {
    it("second register with same email returns DUPLICATE_ERROR", async () => {
      const firstResult = await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(firstResult.isOk()).toBe(true);

      const secondResult = await register.execute({
        email: VALID_EMAIL,
        password: "AnotherSecurePass1!",
      });

      expect(secondResult.isErr()).toBe(true);
      if (secondResult.isErr()) {
        expect(secondResult.error.code).toBe("DUPLICATE_ERROR");
      }
    });
  });
});
