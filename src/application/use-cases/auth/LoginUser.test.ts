import { describe, it, expect, beforeEach } from "vitest";
import { LoginUser } from "./LoginUser";
import { RegisterUser } from "./RegisterUser";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

describe("LoginUser", () => {
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let jwtService: FakeJwtService;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let loginUser: LoginUser;
  let registerUser: RegisterUser;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    jwtService = new FakeJwtService();
    refreshTokenService = new FakeRefreshTokenService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));
    loginUser = new LoginUser(
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      jwtService,
      refreshTokenService,
      clock,
      900,
      7,
    );
    registerUser = new RegisterUser(
      userRepository,
      refreshTokenRepository,
      passwordHasher,
      jwtService,
      refreshTokenService,
      clock,
      900,
      7,
    );
  });

  it("should login successfully with correct credentials", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const result = await loginUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.user.email).toBe("user@example.com");
      expect(result.value.user.id).toBeDefined();
    }
  });

  it("should return tokens on success", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const result = await loginUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.tokens.accessToken).toMatch(
        /^fake-header\..*\.fake-signature$/,
      );
      expect(result.value.tokens.refreshToken).toMatch(
        /^fake-refresh-token-.*-\d+$/,
      );
    }
  });

  it("should reject non-existent email (generic error)", async () => {
    const result = await loginUser.execute({
      email: "unknown@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toBe("Invalid email or password");
    }
  });

  it("should reject wrong password (generic error)", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const result = await loginUser.execute({
      email: VALID_EMAIL,
      password: "WrongPassword1!",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toBe("Invalid email or password");
    }
  });

  it("should reject invalid email format", async () => {
    const result = await loginUser.execute({
      email: "not-an-email",
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Email");
    }
  });

  it("should reject empty email", async () => {
    const result = await loginUser.execute({
      email: "",
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
