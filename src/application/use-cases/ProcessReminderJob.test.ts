import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ProcessReminderJob } from "./ProcessReminderJob";
import { InMemoryReminderRepository } from "../test/InMemoryReminderRepository";
import { InMemoryNotificationRepository } from "../test/InMemoryNotificationRepository";
import { FakeAutomationPort } from "../test/FakeAutomationPort";
import { Reminder } from "../../domain/entities/Reminder";

describe("ProcessReminderJob", () => {
  let reminderRepository: InMemoryReminderRepository;
  let notificationRepository: InMemoryNotificationRepository;
  let automationPort: FakeAutomationPort;
  let processJob: ProcessReminderJob;

  const userId = "user-123";
  const reminderId = "rem-123";
  const originalScheduledAt = "2026-02-05T18:30:00.000Z";

  const createTestReminder = async (
    status: string = "pending",
    scheduledAt: string = originalScheduledAt,
    channel: string = "whatsapp"
  ) => {
    const reminderResult = Reminder.create({
      id: reminderId,
      userId,
      entryId: "entry-123",
      scheduledAt,
      channel,
      message: "Test reminder",
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await reminderRepository.create(reminderResult.value);
    return reminderResult.value;
  };

  beforeEach(() => {
    reminderRepository = new InMemoryReminderRepository();
    notificationRepository = new InMemoryNotificationRepository();
    automationPort = new FakeAutomationPort();
    processJob = new ProcessReminderJob(
      reminderRepository,
      notificationRepository,
      automationPort,
      () => "notif-test-id"
    );
  });

  describe("successful processing", () => {
    it("should process pending reminder and mark as sent", async () => {
      await createTestReminder();

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(true);
        expect(result.value.status).toBe("sent");
      }
    });

    it("should update reminder status to sent", async () => {
      await createTestReminder();

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const reminder = await reminderRepository.findById(reminderId);
      expect(reminder?.status.isSent()).toBe(true);
    });

    it("should call automation service with correct payload", async () => {
      await createTestReminder();

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const payload = automationPort.getLastSentPayload();
      expect(payload).toBeDefined();
      expect(payload?.reminderId).toBe(reminderId);
      expect(payload?.userId).toBe(userId);
      expect(payload?.channel).toBe("whatsapp");
    });

    it("should create REMINDER_SENT notification", async () => {
      await createTestReminder();

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type.isReminderSent()).toBe(true);
      expect(notifications[0].userId).toBe(userId);
    });
  });

  describe("automation failure", () => {
    it("should mark reminder as failed when automation fails", async () => {
      await createTestReminder();
      automationPort.setShouldSucceed(false);
      automationPort.setErrorMessage("Service unavailable");

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(true);
        expect(result.value.status).toBe("failed");
        expect(result.value.reason).toBe("Service unavailable");
      }
    });

    it("should update reminder status to failed", async () => {
      await createTestReminder();
      automationPort.setShouldSucceed(false);

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const reminder = await reminderRepository.findById(reminderId);
      expect(reminder?.status.isFailed()).toBe(true);
    });

    it("should create REMINDER_FAILED notification", async () => {
      await createTestReminder();
      automationPort.setShouldSucceed(false);

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type.isReminderFailed()).toBe(true);
    });
  });

  describe("push channel (in-app only, no n8n)", () => {
    it("should NOT call automation service for push channel", async () => {
      await createTestReminder("pending", originalScheduledAt, "push");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(automationPort.getSentPayloads()).toHaveLength(0);
    });

    it("should mark reminder as sent for push channel", async () => {
      await createTestReminder("pending", originalScheduledAt, "push");

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(true);
        expect(result.value.status).toBe("sent");
      }

      const reminder = await reminderRepository.findById(reminderId);
      expect(reminder?.status.isSent()).toBe(true);
    });

    it("should create REMINDER_SENT notification for push channel", async () => {
      await createTestReminder("pending", originalScheduledAt, "push");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type.isReminderSent()).toBe(true);
    });

    it("should still call automation for email channel", async () => {
      await createTestReminder("pending", originalScheduledAt, "email");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(automationPort.getSentPayloads()).toHaveLength(1);
      expect(automationPort.getLastSentPayload()?.channel).toBe("email");
    });

    it("should still call automation for whatsapp channel", async () => {
      await createTestReminder("pending", originalScheduledAt, "whatsapp");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(automationPort.getSentPayloads()).toHaveLength(1);
      expect(automationPort.getLastSentPayload()?.channel).toBe("whatsapp");
    });
  });

  describe("skip scenarios", () => {
    it("should skip if reminder not found", async () => {
      const result = await processJob.execute({
        reminderId: "non-existent",
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("not found");
      }
    });

    it("should NOT call automation if reminder not found", async () => {
      await processJob.execute({
        reminderId: "non-existent",
        originalScheduledAt,
      });

      expect(automationPort.getSentPayloads()).toHaveLength(0);
    });

    it("should skip if reminder is already sent", async () => {
      await createTestReminder("sent");

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("sent");
      }
    });

    it("should skip if reminder is canceled", async () => {
      await createTestReminder("canceled");

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
      }
    });

    it("should skip if reminder was rescheduled", async () => {
      // Create reminder with different scheduledAt than job
      await createTestReminder("pending", "2026-02-06T10:00:00.000Z");

      const result = await processJob.execute({
        reminderId,
        originalScheduledAt, // Original time, not the new one
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("rescheduled");
      }
    });

    it("should NOT call automation if rescheduled", async () => {
      await createTestReminder("pending", "2026-02-06T10:00:00.000Z");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(automationPort.getSentPayloads()).toHaveLength(0);
    });

    it("should NOT create notification when skipped", async () => {
      await createTestReminder("canceled");

      await processJob.execute({
        reminderId,
        originalScheduledAt,
      });

      expect(notificationRepository.getAll()).toHaveLength(0);
    });
  });
});
