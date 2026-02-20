import { describe, it, expect, beforeEach } from "vitest";
import { ResendVerificationEmail } from "./ResendVerificationEmail";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { InMemoryEmailVerificationTokenRepository } from "../../test/InMemoryEmailVerificationTokenRepository";
import { FakeRefreshTokenService } from "../../test/FakeRefreshTokenService";
import { FakeEmailService } from "../../test/FakeEmailService";
import { FakeClock } from "../../test/FakeClock";
import { User } from "@/domain/entities/User";
import type { EmailServicePort } from "@/application/ports/EmailServicePort";

const NOW = new Date("2026-02-19T12:00:00Z");
const VERIFICATION_TTL_HOURS = 24;
const APP_BASE_URL = "https://app.test";

function createUser(
  repo: InMemoryUserRepository,
  overrides: { emailVerified?: boolean } = {},
) {
  const result = User.create({
    id: "user-1",
    email: "test@example.com",
    passwordHash: "hashed:password",
    emailVerified: overrides.emailVerified ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  if (result.isOk()) repo.create(result.value);
}

describe("ResendVerificationEmail", () => {
  let userRepository: InMemoryUserRepository;
  let tokenRepository: InMemoryEmailVerificationTokenRepository;
  let refreshTokenService: FakeRefreshTokenService;
  let emailService: FakeEmailService;
  let clock: FakeClock;
  let resend: ResendVerificationEmail;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    tokenRepository = new InMemoryEmailVerificationTokenRepository();
    refreshTokenService = new FakeRefreshTokenService();
    emailService = new FakeEmailService();
    clock = new FakeClock(NOW);
    resend = new ResendVerificationEmail(
      userRepository,
      tokenRepository,
      refreshTokenService,
      clock,
      VERIFICATION_TTL_HOURS,
      emailService,
      APP_BASE_URL,
    );
  });

  it("should send verification email for unverified user", async () => {
    createUser(userRepository, { emailVerified: false });

    const result = await resend.execute({ email: "test@example.com" });

    expect(result.isOk()).toBe(true);
    expect(emailService.sent).toHaveLength(1);
    expect(emailService.sent[0].to).toBe("test@example.com");
    expect(emailService.sent[0].subject).toContain("Verify");
  });

  it("should return ok for non-existent email (no enumeration)", async () => {
    const result = await resend.execute({ email: "unknown@example.com" });

    expect(result.isOk()).toBe(true);
    expect(emailService.sent).toHaveLength(0);
  });

  it("should return ok for already-verified user (no email sent)", async () => {
    createUser(userRepository, { emailVerified: true });

    const result = await resend.execute({ email: "test@example.com" });

    expect(result.isOk()).toBe(true);
    expect(emailService.sent).toHaveLength(0);
  });

  it("should create new token with correct expiry", async () => {
    createUser(userRepository, { emailVerified: false });

    await resend.execute({ email: "test@example.com" });

    const tokens = tokenRepository.getAll();
    expect(tokens).toHaveLength(1);
    const expectedExpiry = new Date(
      NOW.getTime() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );
    expect(tokens[0].expiresAt.getTime()).toBe(expectedExpiry.getTime());
  });

  it("should reject invalid email format", async () => {
    const result = await resend.execute({ email: "not-an-email" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should handle email service failure gracefully", async () => {
    createUser(userRepository, { emailVerified: false });

    const failingEmailService: EmailServicePort = {
      async send() {
        throw new Error("SMTP unavailable");
      },
    };
    const useCaseWithFailingEmail = new ResendVerificationEmail(
      userRepository,
      tokenRepository,
      refreshTokenService,
      clock,
      VERIFICATION_TTL_HOURS,
      failingEmailService,
      APP_BASE_URL,
    );

    const result = await useCaseWithFailingEmail.execute({
      email: "test@example.com",
    });

    expect(result.isOk()).toBe(true);
    const tokens = tokenRepository.getAll();
    expect(tokens).toHaveLength(1);
  });
});
