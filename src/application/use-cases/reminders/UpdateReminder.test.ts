import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UpdateReminder } from "./UpdateReminder";
import { InMemoryReminderRepository } from "../../test/InMemoryReminderRepository";
import { FakeQueuePort } from "../../test/FakeQueuePort";
import { Reminder } from "../../../domain/entities/Reminder";

describe("UpdateReminder", () => {
  let reminderRepository: InMemoryReminderRepository;
  let queuePort: FakeQueuePort;
  let updateReminder: UpdateReminder;

  const userId = "user-123";
  const reminderId = "rem-123";

  const createTestReminder = async (status: string = "pending") => {
    const reminderResult = Reminder.create({
      id: reminderId,
      userId,
      entryId: "entry-123",
      scheduledAt: "2026-02-05T18:30:00.000Z",
      channel: "whatsapp",
      message: "Original message",
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await reminderRepository.create(reminderResult.value);
    return reminderResult.value;
  };

  beforeEach(() => {
    reminderRepository = new InMemoryReminderRepository();
    queuePort = new FakeQueuePort();
    updateReminder = new UpdateReminder(reminderRepository, queuePort);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-05T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("success scenarios", () => {
    it("should reschedule a pending reminder", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        scheduledAt: "2026-02-06T10:00:00.000Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.scheduledAt).toBe("2026-02-06T10:00:00.000Z");
      }
    });

    it("should update channel", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        channel: "email",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.channel).toBe("email");
      }
    });

    it("should update message", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        message: "New message",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.message).toBe("New message");
      }
    });

    it("should cancel a pending reminder", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        status: "canceled",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("canceled");
      }
    });

    it("should enqueue new job when rescheduling", async () => {
      await createTestReminder();

      await updateReminder.execute({
        userId,
        reminderId,
        scheduledAt: "2026-02-06T10:00:00.000Z",
      });

      const jobs = queuePort.getEnqueuedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].scheduledAt).toBe("2026-02-06T10:00:00.000Z");
    });

    it("should NOT enqueue job when canceling", async () => {
      await createTestReminder();

      await updateReminder.execute({
        userId,
        reminderId,
        status: "canceled",
      });

      const jobs = queuePort.getEnqueuedJobs();
      expect(jobs).toHaveLength(0);
    });
  });

  describe("conflict errors", () => {
    it("should reject update for sent reminder", async () => {
      await createTestReminder("sent");

      const result = await updateReminder.execute({
        userId,
        reminderId,
        message: "New message",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("Cannot modify");
      }
    });

    it("should reject update for canceled reminder", async () => {
      await createTestReminder("canceled");

      const result = await updateReminder.execute({
        userId,
        reminderId,
        message: "New message",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });

    it("should reject update for failed reminder", async () => {
      await createTestReminder("failed");

      const result = await updateReminder.execute({
        userId,
        reminderId,
        message: "New message",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });
  });

  describe("not found errors", () => {
    it("should reject if reminder not found", async () => {
      const result = await updateReminder.execute({
        userId,
        reminderId: "non-existent",
        message: "New message",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should reject if reminder belongs to different user", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId: "other-user",
        reminderId,
        message: "New message",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject if new scheduledAt is in the past", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        scheduledAt: "2026-02-05T08:00:00.000Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("future");
      }
    });

    it("should reject invalid channel", async () => {
      await createTestReminder();

      const result = await updateReminder.execute({
        userId,
        reminderId,
        channel: "invalid-channel",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
