import { describe, it, expect, beforeEach } from "vitest";
import { LoginUser } from "./LoginUser";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryRefreshTokenRepository } from "../../test/InMemoryRefreshTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeJwtService } from "../../test/FakeJwtService";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";

async function seedVerifiedUser(
  repo: InMemoryUserRepository,
  hasher: FakePasswordHasher,
  overrides: { emailVerified?: boolean } = {},
) {
  const hash = await hasher.hash(VALID_PASSWORD);
  const result = User.create({
    id: "user-1",
    email: VALID_EMAIL,
    passwordHash: hash,
    emailVerified: overrides.emailVerified ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  if (result.isOk()) await repo.create(result.value);
}

describe("LoginUser", () => {
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let jwtService: FakeJwtService;
  let refreshTokenService: FakeRefreshTokenService;
  let clock: FakeClock;
  let loginUser: LoginUser;

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
  });

  it("should login successfully with correct credentials", async () => {
    await seedVerifiedUser(userRepository, passwordHasher);

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
    await seedVerifiedUser(userRepository, passwordHasher);

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
    await seedVerifiedUser(userRepository, passwordHasher);

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

  it("should reject login for unverified email", async () => {
    await seedVerifiedUser(userRepository, passwordHasher, {
      emailVerified: false,
    });

    const result = await loginUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("EMAIL_NOT_VERIFIED");
      expect(result.error.message).toContain("verify");
    }
  });

  it("should allow login for verified users", async () => {
    await seedVerifiedUser(userRepository, passwordHasher, {
      emailVerified: true,
    });

    const result = await loginUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
  });
});
