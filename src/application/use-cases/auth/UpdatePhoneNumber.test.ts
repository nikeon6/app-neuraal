import { describe, it, expect, beforeEach } from "vitest";
import { UpdatePhoneNumber } from "./UpdatePhoneNumber";
import { InMemoryUserRepository } from "../../test/InMemoryUserRepository";
import { User } from "@/domain/entities/User";

function createTestUser(overrides?: Partial<{ phoneNumber: string | null }>) {
  return User.create({
    id: "user-1",
    email: "test@example.com",
    passwordHash: "hashed:password",
    phoneNumber: overrides?.phoneNumber ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("UpdatePhoneNumber", () => {
  let userRepository: InMemoryUserRepository;
  let useCase: UpdatePhoneNumber;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    useCase = new UpdatePhoneNumber(userRepository);
  });

  it("should save a valid phone number in E.164 format", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "+34612345678",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.phoneNumber).toBe("+34612345678");
    }

    const updated = await userRepository.findById("user-1");
    expect(updated?.phoneNumber).toBe("+34612345678");
  });

  it("should allow clearing the phone number with null", async () => {
    const userResult = createTestUser({ phoneNumber: "+34612345678" });
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: null,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.phoneNumber).toBeNull();
    }

    const updated = await userRepository.findById("user-1");
    expect(updated?.phoneNumber).toBeNull();
  });

  it("should allow clearing the phone number with empty string", async () => {
    const userResult = createTestUser({ phoneNumber: "+34612345678" });
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.phoneNumber).toBeNull();
    }
  });

  it("should reject phone numbers without + prefix", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "34612345678",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject phone numbers with letters", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "+34abc123",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject phone numbers that are too short", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "+123",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject phone numbers that are too long", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "+1234567890123456",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should accept various valid international formats", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const validNumbers = [
      "+14155552671",
      "+442071234567",
      "+34612345678",
      "+5511987654321",
      "+8613800138000",
    ];

    for (const phoneNumber of validNumbers) {
      const result = await useCase.execute({ userId: "user-1", phoneNumber });
      expect(result.isOk(), `Expected ${phoneNumber} to be valid`).toBe(true);
    }
  });

  it("should strip spaces and dashes before validation", async () => {
    const userResult = createTestUser();
    if (userResult.isOk()) await userRepository.create(userResult.value);

    const result = await useCase.execute({
      userId: "user-1",
      phoneNumber: "+34 612 345 678",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.phoneNumber).toBe("+34612345678");
    }
  });

  it("should return NOT_FOUND for non-existent user", async () => {
    const result = await useCase.execute({
      userId: "non-existent",
      phoneNumber: "+34612345678",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should reject empty userId", async () => {
    const result = await useCase.execute({
      userId: "",
      phoneNumber: "+34612345678",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("userId cannot be empty");
    }
  });
});
