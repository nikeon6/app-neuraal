import { describe, it, expect, beforeEach } from "vitest";
import { RegisterUser } from "./RegisterUser";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

describe("RegisterUser", () => {
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let jwtService: FakeJwtService;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let registerUser: RegisterUser;

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
      7,
    );
  });

  it("should register a new user successfully (returns user + tokens)", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.user.id).toBeDefined();
      expect(result.value.user.email).toBe(VALID_EMAIL);
      expect(result.value.tokens.accessToken).toMatch(
        /^fake-header\..*\.fake-signature$/,
      );
      expect(result.value.tokens.refreshToken).toMatch(
        /^fake-refresh-token-.*-\d+$/,
      );
    }
  });

  it("should persist user in repository", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    const users = userRepository.getAll();
    expect(users).toHaveLength(1);
    expect(users[0].email.toString()).toBe(VALID_EMAIL);
  });

  it("should persist refresh token in repository", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    const tokens = refreshTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toMatch(/^sha256:fake-refresh-token-/);
  });

  it("should hash the password", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const users = userRepository.getAll();
    expect(users).toHaveLength(1);
    expect(users[0].passwordHash.toString()).toBe(`hashed:${VALID_PASSWORD}`);
  });

  it("should reject invalid email", async () => {
    const result = await registerUser.execute({
      email: "not-an-email",
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Email");
    }
  });

  it("should reject weak password - too short", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: "Short1!",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("8 characters");
    }
  });

  it("should reject weak password - no uppercase", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: "lowercase1!",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("uppercase");
    }
  });

  it("should reject weak password - no lowercase", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: "UPPERCASE1!",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("lowercase");
    }
  });

  it("should reject weak password - no number", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: "NoNumbers!",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("number");
    }
  });

  it("should reject weak password - no special character", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: "NoSpecial1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("special");
    }
  });

  it("should reject duplicate email", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
      expect(result.error.message).toContain("already exists");
    }
  });

  it("should reject duplicate email (case-insensitive)", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const result = await registerUser.execute({
      email: "USER@EXAMPLE.COM",
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("DUPLICATE_ERROR");
    }
  });
});
