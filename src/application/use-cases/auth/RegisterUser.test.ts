import { describe, it, expect, beforeEach } from "vitest";
import { RegisterUser } from "./RegisterUser";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryEmailVerificationTokenRepository } from "../../test/InMemoryEmailVerificationTokenRepository";
import { FakePasswordHasher } from "../../test/FakePasswordHasher";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeEmailService } from "../../test/FakeEmailService";
import { FakeClock } from "../../test/FakeClock";
import type { EmailServicePort } from "@/application/ports/EmailServicePort";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass1!";
const VERIFICATION_TTL_HOURS = 24;
const APP_BASE_URL = "https://app.test";

describe("RegisterUser", () => {
  let userRepository: InMemoryUserRepository;
  let emailVerificationTokenRepository: InMemoryEmailVerificationTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let refreshTokenService: FakeRefreshTokenService;
  let emailService: FakeEmailService;
  let clock: FakeClock;
  let registerUser: RegisterUser;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    emailVerificationTokenRepository =
      new InMemoryEmailVerificationTokenRepository();
    passwordHasher = new FakePasswordHasher();
    refreshTokenService = new FakeRefreshTokenService();
    emailService = new FakeEmailService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));
    registerUser = new RegisterUser(
      userRepository,
      passwordHasher,
      refreshTokenService,
      clock,
      emailVerificationTokenRepository,
      emailService,
      APP_BASE_URL,
      VERIFICATION_TTL_HOURS,
    );
  });

  it("should register a new user successfully (returns user + message)", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.user.id).toBeDefined();
      expect(result.value.user.email).toBe(VALID_EMAIL);
      expect(result.value.message).toBeDefined();
      expect(result.value.message.length).toBeGreaterThan(0);
    }
  });

  it("should register user with emailVerified=false", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const users = userRepository.getAll();
    expect(users).toHaveLength(1);
    expect(users[0].emailVerified).toBe(false);
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

  it("should hash the password", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const users = userRepository.getAll();
    expect(users).toHaveLength(1);
    expect(users[0].passwordHash.toString()).toBe(`hashed:${VALID_PASSWORD}`);
  });

  it("should create verification token in repository", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const tokens = emailVerificationTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toMatch(/^sha256:fake-refresh-token-/);
  });

  it("should create token with 24h expiry", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const tokens = emailVerificationTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    const expectedExpiry = new Date(
      clock.now().getTime() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );
    expect(tokens[0].expiresAt.getTime()).toBe(expectedExpiry.getTime());
  });

  it("should send verification email with correct link", async () => {
    await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(emailService.sent).toHaveLength(1);
    expect(emailService.sent[0].to).toBe(VALID_EMAIL);
    expect(emailService.sent[0].subject).toContain("Verify");
    expect(emailService.sent[0].html).toContain(APP_BASE_URL);
  });

  it("should NOT generate JWT or refresh tokens", async () => {
    const result = await registerUser.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value as Record<string, unknown>).tokens).toBeUndefined();
    }
  });

  it("should handle email service failure gracefully", async () => {
    const failingEmailService: EmailServicePort = {
      async send() {
        throw new Error("SMTP unavailable");
      },
    };
    const useCaseWithFailingEmail = new RegisterUser(
      userRepository,
      passwordHasher,
      refreshTokenService,
      clock,
      emailVerificationTokenRepository,
      failingEmailService,
      APP_BASE_URL,
      VERIFICATION_TTL_HOURS,
    );

    const result = await useCaseWithFailingEmail.execute({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result.isOk()).toBe(true);
    const users = userRepository.getAll();
    expect(users).toHaveLength(1);
    const tokens = emailVerificationTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
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
