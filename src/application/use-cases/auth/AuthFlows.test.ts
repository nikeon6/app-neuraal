import { describe, it, expect, beforeEach } from "vitest";
import { RegisterUser } from "./RegisterUser";
import { VerifyEmail } from "./VerifyEmail";
import { LoginUser } from "./LoginUser";
import { RefreshSession } from "./RefreshSession";
import { LogoutUser } from "./LogoutUser";
import { GetMe } from "./GetMe";
import { RequestPasswordReset } from "./RequestPasswordReset";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { InMemoryPasswordResetTokenRepository } from "../../test/InMemoryPasswordResetTokenRepository";
import { InMemoryEmailVerificationTokenRepository } from "../../test/InMemoryEmailVerificationTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeEmailService } from "../../test/FakeEmailService";
import { FakeClock } from "../../test/FakeClock";

const ACCESS_TTL = 900;
const REFRESH_TTL_DAYS = 30;
const RESET_TTL_MINUTES = 30;
const VERIFICATION_TTL_HOURS = 24;
const APP_BASE_URL = "https://app.test";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

let userRepo: InMemoryUserRepository;
let refreshTokenRepo: InMemoryRefreshTokenRepository;
let resetTokenRepo: InMemoryPasswordResetTokenRepository;
let emailVerificationTokenRepo: InMemoryEmailVerificationTokenRepository;
let hasher: FakePasswordHasher;
let jwtService: FakeJwtService;
let tokenService: FakeRefreshTokenService;
let emailService: FakeEmailService;
let clock: FakeClock;
let register: RegisterUser;
let verifyEmailUC: VerifyEmail;
let loginUC: LoginUser;
let refresh: RefreshSession;
let logoutUC: LogoutUser;
let getMe: GetMe;
let recover: RequestPasswordReset;

async function registerAndVerify(
  email = VALID_EMAIL,
  password = VALID_PASSWORD,
) {
  const regResult = await register.execute({ email, password });
  expect(regResult.isOk()).toBe(true);

  const rawToken =
    emailService.sent[emailService.sent.length - 1].html.match(
      /token=([^"&]+)/,
    )![1];

  const verifyResult = await verifyEmailUC.execute({
    token: decodeURIComponent(rawToken),
  });
  expect(verifyResult.isOk()).toBe(true);

  return regResult;
}

describe("AuthFlows (integration)", () => {
  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    resetTokenRepo = new InMemoryPasswordResetTokenRepository();
    emailVerificationTokenRepo = new InMemoryEmailVerificationTokenRepository();
    hasher = new FakePasswordHasher();
    jwtService = new FakeJwtService();
    tokenService = new FakeRefreshTokenService();
    emailService = new FakeEmailService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));

    register = new RegisterUser(
      userRepo,
      hasher,
      tokenService,
      clock,
      emailVerificationTokenRepo,
      emailService,
      APP_BASE_URL,
      VERIFICATION_TTL_HOURS,
    );

    verifyEmailUC = new VerifyEmail(
      userRepo,
      emailVerificationTokenRepo,
      tokenService,
      clock,
    );

    loginUC = new LoginUser(
      userRepo,
      refreshTokenRepo,
      hasher,
      jwtService,
      tokenService,
      clock,
      ACCESS_TTL,
      REFRESH_TTL_DAYS,
    );

    refresh = new RefreshSession(
      userRepo,
      refreshTokenRepo,
      jwtService,
      tokenService,
      clock,
      ACCESS_TTL,
      REFRESH_TTL_DAYS,
    );

    logoutUC = new LogoutUser(refreshTokenRepo, tokenService, clock);

    getMe = new GetMe(userRepo);

    recover = new RequestPasswordReset(
      userRepo,
      resetTokenRepo,
      tokenService,
      clock,
      RESET_TTL_MINUTES,
      emailService,
      APP_BASE_URL,
    );
  });

  describe("1. Full registration + verify + login + me + logout flow", () => {
    it("registers user, verifies email, logs in, gets me, logs out", async () => {
      await registerAndVerify();

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(loginResult.isOk()).toBe(true);
      if (!loginResult.isOk()) return;

      const { user: loginUser, tokens: loginTokens } = loginResult.value;

      const payload = await jwtService.verify(loginTokens.accessToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(loginUser.id);
      expect(payload!.email).toBe(VALID_EMAIL);

      const meResult = await getMe.execute({ userId: loginUser.id });
      expect(meResult.isOk()).toBe(true);
      if (!meResult.isOk()) return;
      expect(meResult.value.id).toBe(loginUser.id);
      expect(meResult.value.email).toBe(VALID_EMAIL);

      const logoutResult = await logoutUC.execute({ userId: loginUser.id });
      expect(logoutResult.isOk()).toBe(true);

      const allTokens = refreshTokenRepo.getAll();
      const userTokens = allTokens.filter((t) => t.userId === loginUser.id);
      expect(userTokens.length).toBeGreaterThan(0);
      expect(userTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });
  });

  describe("2. Register then login with wrong password", () => {
    it("fails login with UNAUTHORIZED when password is wrong", async () => {
      await registerAndVerify();

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

  describe("3. Login rejected for unverified user", () => {
    it("login fails with EMAIL_NOT_VERIFIED before email is verified", async () => {
      await register.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });

      expect(loginResult.isErr()).toBe(true);
      if (loginResult.isErr()) {
        expect(loginResult.error.code).toBe("EMAIL_NOT_VERIFIED");
      }
    });
  });

  describe("4. Refresh token rotation", () => {
    it("rotates token on refresh, old revoked, new works, old replay fails", async () => {
      await registerAndVerify();

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(loginResult.isOk()).toBe(true);
      if (!loginResult.isOk()) return;

      const originalRefreshToken = loginResult.value.tokens.refreshToken;

      const refresh1Result = await refresh.execute({
        refreshToken: originalRefreshToken,
      });
      expect(refresh1Result.isOk()).toBe(true);
      if (!refresh1Result.isOk()) return;

      const newRefreshToken = refresh1Result.value.tokens.refreshToken;
      expect(newRefreshToken).not.toBe(originalRefreshToken);

      const oldTokenHash = tokenService.hashToken(originalRefreshToken);
      const oldStored = await refreshTokenRepo.findByTokenHash(oldTokenHash);
      expect(oldStored).not.toBeNull();
      expect(oldStored!.revokedAt).not.toBeNull();

      const refresh2Result = await refresh.execute({
        refreshToken: newRefreshToken,
      });
      expect(refresh2Result.isOk()).toBe(true);

      const replayResult = await refresh.execute({
        refreshToken: originalRefreshToken,
      });
      expect(replayResult.isErr()).toBe(true);
      if (replayResult.isErr()) {
        expect(replayResult.error.code).toBe("UNAUTHORIZED");
        expect(replayResult.error.message).toContain("Token reuse detected");
      }
    });
  });

  describe("5. Double refresh with same token (replay attack)", () => {
    it("refreshing with revoked token returns UNAUTHORIZED", async () => {
      await registerAndVerify();

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(loginResult.isOk()).toBe(true);
      if (!loginResult.isOk()) return;

      const originalRefreshToken = loginResult.value.tokens.refreshToken;

      const firstRefresh = await refresh.execute({
        refreshToken: originalRefreshToken,
      });
      expect(firstRefresh.isOk()).toBe(true);

      const secondRefresh = await refresh.execute({
        refreshToken: originalRefreshToken,
      });
      expect(secondRefresh.isErr()).toBe(true);
      if (secondRefresh.isErr()) {
        expect(secondRefresh.error.code).toBe("UNAUTHORIZED");
        expect(secondRefresh.error.message).toContain("Token reuse detected");
      }
    });
  });

  describe("6. Logout revokes all tokens", () => {
    it("logout without token revokes all refresh tokens for user", async () => {
      await registerAndVerify();

      const login1 = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(login1.isOk()).toBe(true);
      if (!login1.isOk()) return;
      const userId = login1.value.user.id;
      const token1 = login1.value.tokens.refreshToken;

      const login2 = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(login2.isOk()).toBe(true);
      if (!login2.isOk()) return;
      const token2 = login2.value.tokens.refreshToken;

      const login3 = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(login3.isOk()).toBe(true);
      if (!login3.isOk()) return;
      const token3 = login3.value.tokens.refreshToken;

      const logoutResult = await logoutUC.execute({ userId });
      expect(logoutResult.isOk()).toBe(true);

      const refresh1 = await refresh.execute({ refreshToken: token1 });
      const refresh2 = await refresh.execute({ refreshToken: token2 });
      const refresh3 = await refresh.execute({ refreshToken: token3 });

      expect(refresh1.isErr()).toBe(true);
      expect(refresh2.isErr()).toBe(true);
      expect(refresh3.isErr()).toBe(true);

      const allTokens = refreshTokenRepo
        .getAll()
        .filter((t) => t.userId === userId);
      expect(allTokens.every((t) => t.revokedAt !== null)).toBe(true);
    });
  });

  describe("7. Password recover always returns ok", () => {
    it("existing email creates reset token, non-existing does not", async () => {
      const recover1Result = await recover.execute({
        email: "nonexistent@example.com",
      });
      expect(recover1Result.isOk()).toBe(true);
      expect(resetTokenRepo.getAll()).toHaveLength(0);

      await registerAndVerify();

      const recover2Result = await recover.execute({ email: VALID_EMAIL });
      expect(recover2Result.isOk()).toBe(true);
      expect(resetTokenRepo.getAll()).toHaveLength(1);
      expect(resetTokenRepo.getAll()[0].userId).toBe(userRepo.getAll()[0].id);
    });
  });

  describe("8. Expired refresh token is rejected", () => {
    it("refresh fails when token is past expiry", async () => {
      await registerAndVerify();

      const loginResult = await loginUC.execute({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
      expect(loginResult.isOk()).toBe(true);
      if (!loginResult.isOk()) return;

      const originalRefreshToken = loginResult.value.tokens.refreshToken;

      const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
      clock.advance(thirtyOneDays);

      const refreshResult = await refresh.execute({
        refreshToken: originalRefreshToken,
      });

      expect(refreshResult.isErr()).toBe(true);
      if (refreshResult.isErr()) {
        expect(refreshResult.error.code).toBe("UNAUTHORIZED");
        expect(refreshResult.error.message).toContain("Invalid or expired");
      }
    });
  });

  describe("9. Register with duplicate email", () => {
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
