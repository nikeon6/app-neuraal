import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CreateReminder } from "./CreateReminder";
import { InMemoryReminderRepository } from "../../test/InMemoryReminderRepository";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { FakeQueuePort } from "../../test/FakeQueuePort";
import { Entry } from "../../../domain/entities/Entry";

describe("CreateReminder", () => {
  let reminderRepository: InMemoryReminderRepository;
  let entryRepository: InMemoryEntryRepository;
  let queuePort: FakeQueuePort;
  let createReminder: CreateReminder;
  let testEntry: Entry;

  const userId = "user-123";
  const entryId = "entry-123";

  beforeEach(async () => {
    reminderRepository = new InMemoryReminderRepository();
    entryRepository = new InMemoryEntryRepository();
    queuePort = new FakeQueuePort();
    createReminder = new CreateReminder(
      reminderRepository,
      entryRepository,
      queuePort,
      () => "rem-test-id"
    );

    // Create a test entry
    const entryResult = Entry.create({
      id: entryId,
      userId,
      date: "2026-02-05",
      type: "task",
      title: "Test Task",
      content: {},
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testEntry = entryResult.value;
    await entryRepository.save(testEntry);

    // Mock Date.now for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-05T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("success scenarios", () => {
    it("should create a reminder with valid data", async () => {
      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
        message: "Don't forget!",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("rem-test-id");
        expect(result.value.userId).toBe(userId);
        expect(result.value.entryId).toBe(entryId);
        expect(result.value.channel).toBe("whatsapp");
        expect(result.value.message).toBe("Don't forget!");
        expect(result.value.status).toBe("pending");
      }
    });

    it("should create a reminder without message", async () => {
      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "email",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.message).toBeNull();
      }
    });

    it("should save reminder to repository", async () => {
      await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
      });

      const saved = await reminderRepository.findById("rem-test-id");
      expect(saved).not.toBeNull();
      expect(saved?.userId).toBe(userId);
    });

    it("should enqueue job with correct data", async () => {
      await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
      });

      const jobs = queuePort.getEnqueuedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].reminderId).toBe("rem-test-id");
      expect(jobs[0].scheduledAt).toBe("2026-02-05T18:30:00.000Z");
    });

    it("should accept scheduledAt within 2s tolerance", async () => {
      // Set time to just before scheduledAt (within 2s tolerance)
      vi.setSystemTime(new Date("2026-02-05T18:30:01.000Z"));

      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should reject if entry not found", async () => {
      const result = await createReminder.execute({
        userId,
        entryId: "non-existent",
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("Entry not found");
      }
    });

    it("should reject if entry belongs to different user", async () => {
      const result = await createReminder.execute({
        userId: "other-user",
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "whatsapp",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should reject if scheduledAt is in the past", async () => {
      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T08:00:00.000Z", // Before current time
        channel: "whatsapp",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("future");
      }
    });

    it("should reject if scheduledAt is invalid format", async () => {
      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "not-a-date",
        channel: "whatsapp",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject if channel is invalid", async () => {
      const result = await createReminder.execute({
        userId,
        entryId,
        scheduledAt: "2026-02-05T18:30:00.000Z",
        channel: "carrier-pigeon",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Invalid channel");
      }
    });
  });
});
