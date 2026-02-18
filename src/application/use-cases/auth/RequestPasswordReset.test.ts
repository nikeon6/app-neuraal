import { describe, it, expect, beforeEach } from "vitest";
import { RequestPasswordReset } from "./RequestPasswordReset";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryPasswordResetTokenRepository } from "../../test/InMemoryPasswordResetTokenRepository";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeEmailService } from "../../test/FakeEmailService";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";
import type { EmailServicePort } from "@/application/ports/EmailServicePort";

const RESET_TTL_MINUTES = 60;
const APP_BASE_URL = "https://app.test";

describe("RequestPasswordReset", () => {
  let userRepository: InMemoryUserRepository;
  let passwordResetTokenRepository: InMemoryPasswordResetTokenRepository;
  let refreshTokenService: FakeRefreshTokenService;
  let emailService: FakeEmailService;
  let clock: FakeClock;
  let requestPasswordReset: RequestPasswordReset;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    passwordResetTokenRepository = new InMemoryPasswordResetTokenRepository();
    refreshTokenService = new FakeRefreshTokenService();
    emailService = new FakeEmailService();
    clock = new FakeClock(new Date("2026-02-11T12:00:00Z"));
    requestPasswordReset = new RequestPasswordReset(
      userRepository,
      passwordResetTokenRepository,
      refreshTokenService,
      clock,
      RESET_TTL_MINUTES,
      emailService,
      APP_BASE_URL,
    );
  });

  it("should return ok for existing user (creates token in DB)", async () => {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:password",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepository.create(userResult.value);
    }

    const result = await requestPasswordReset.execute({
      email: "test@example.com",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(true);
    }
    const tokens = passwordResetTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe("user-1");
    expect(tokens[0].tokenHash).toMatch(/^sha256:fake-refresh-token-/);
  });

  it("should return ok for non-existing email (no token created) — prevents email enumeration", async () => {
    const result = await requestPasswordReset.execute({
      email: "unknown@example.com",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(true);
    }
    const tokens = passwordResetTokenRepository.getAll();
    expect(tokens).toHaveLength(0);
  });

  it("should reject invalid email format", async () => {
    const result = await requestPasswordReset.execute({
      email: "not-an-email",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Email");
    }
  });

  it("should send reset email to existing user", async () => {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:password",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepository.create(userResult.value);
    }

    await requestPasswordReset.execute({ email: "test@example.com" });

    expect(emailService.sent).toHaveLength(1);
    expect(emailService.sent[0].to).toBe("test@example.com");
    expect(emailService.sent[0].subject).toContain("Reset your password");
    expect(emailService.sent[0].html).toContain(APP_BASE_URL);
  });

  it("should not send email for non-existing user", async () => {
    await requestPasswordReset.execute({ email: "unknown@example.com" });

    expect(emailService.sent).toHaveLength(0);
  });

  it("should create token with correct expiry", async () => {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:password",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepository.create(userResult.value);
    }

    await requestPasswordReset.execute({ email: "test@example.com" });

    const tokens = passwordResetTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    const expectedExpiry = new Date(
      clock.now().getTime() + RESET_TTL_MINUTES * 60 * 1000,
    );
    expect(tokens[0].expiresAt.getTime()).toBe(expectedExpiry.getTime());
  });

  it("should return ok when email transport fails for existing user", async () => {
    const userResult = User.create({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed:password",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (userResult.isOk()) {
      await userRepository.create(userResult.value);
    }

    const failingEmailService: EmailServicePort = {
      async send() {
        throw new Error("SMTP unavailable");
      },
    };
    const useCaseWithFailingEmail = new RequestPasswordReset(
      userRepository,
      passwordResetTokenRepository,
      refreshTokenService,
      clock,
      RESET_TTL_MINUTES,
      failingEmailService,
      APP_BASE_URL,
    );

    const result = await useCaseWithFailingEmail.execute({
      email: "test@example.com",
    });

    expect(result.isOk()).toBe(true);
    const tokens = passwordResetTokenRepository.getAll();
    expect(tokens).toHaveLength(1);
  });
});
