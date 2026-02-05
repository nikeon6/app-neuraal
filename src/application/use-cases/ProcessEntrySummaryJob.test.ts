import { describe, it, expect, beforeEach } from "vitest";
import { ProcessEntrySummaryJob } from "./ProcessEntrySummaryJob";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../test/InMemoryNotificationRepository";
import { InMemorySummaryRequestRepository } from "../test/InMemorySummaryRequestRepository";
import { FakeAutomationPort } from "../test/FakeAutomationPort";
import { Entry } from "../../domain/entities/Entry";
import { EntrySummaryRequest } from "../../domain/entities/EntrySummaryRequest";

describe("ProcessEntrySummaryJob", () => {
  let entryRepository: InMemoryEntryRepository;
  let notificationRepository: InMemoryNotificationRepository;
  let summaryRequestRepository: InMemorySummaryRequestRepository;
  let automationPort: FakeAutomationPort;
  let useCase: ProcessEntrySummaryJob;

  const userId = "user-123";
  const entryId = "entry-456";
  const requestId = "request-789";
  const callbackUrl = "http://localhost:3000/api/automations/entry-summary/callback";

  const createTestEntry = async (ownerId: string = userId) => {
    const entryResult = Entry.create({
      id: entryId,
      userId: ownerId,
      date: "2026-01-15",
      type: "note",
      title: "Test Entry",
      content: { text: "This is test content." },
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await entryRepository.save(entryResult.value);
    return entryResult.value;
  };

  const createTestRequest = async (status: string = "pending") => {
    const requestResult = EntrySummaryRequest.create({
      id: requestId,
      userId,
      entryId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await summaryRequestRepository.save(requestResult.value);
    return requestResult.value;
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    notificationRepository = new InMemoryNotificationRepository();
    summaryRequestRepository = new InMemorySummaryRequestRepository();
    automationPort = new FakeAutomationPort();
    useCase = new ProcessEntrySummaryJob(
      entryRepository,
      summaryRequestRepository,
      notificationRepository,
      automationPort,
      callbackUrl,
      () => "test-notif-id"
    );
  });

  describe("successful processing", () => {
    it("should call automation service with correct payload", async () => {
      await createTestEntry();
      await createTestRequest();

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      const payload = automationPort.getLastSentSummaryPayload();
      expect(payload).toBeDefined();
      expect(payload?.requestId).toBe(requestId);
      expect(payload?.userId).toBe(userId);
      expect(payload?.entryId).toBe(entryId);
      expect(payload?.callbackUrl).toBe(callbackUrl);
    });

    it("should mark request as submitted on success", async () => {
      await createTestEntry();
      await createTestRequest();

      await useCase.execute({ requestId, userId, entryId });

      const request = await summaryRequestRepository.findById(requestId);
      expect(request?.status.isSubmitted()).toBe(true);
    });

    it("should return submitted status", async () => {
      await createTestEntry();
      await createTestRequest();

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(true);
        expect(result.value.status).toBe("submitted");
      }
    });
  });

  describe("automation failure", () => {
    it("should mark request as failed when automation fails", async () => {
      await createTestEntry();
      await createTestRequest();
      automationPort.setShouldSucceed(false);
      automationPort.setErrorMessage("n8n unavailable");

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("failed");
        expect(result.value.reason).toBe("n8n unavailable");
      }

      const request = await summaryRequestRepository.findById(requestId);
      expect(request?.status.isFailed()).toBe(true);
    });

    it("should create SUMMARY_FAILED notification on failure", async () => {
      await createTestEntry();
      await createTestRequest();
      automationPort.setShouldSucceed(false);

      await useCase.execute({ requestId, userId, entryId });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type.isSummaryFailed()).toBe(true);
      expect(notifications[0].userId).toBe(userId);
    });
  });

  describe("skip scenarios", () => {
    it("should skip if request not found", async () => {
      await createTestEntry();

      const result = await useCase.execute({
        requestId: "non-existent",
        userId,
        entryId,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("not found");
      }
    });

    it("should skip if entry not found", async () => {
      await createTestRequest();

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("Entry not found");
      }
    });

    it("should skip if entry belongs to different user", async () => {
      await createTestEntry("other-user");
      await createTestRequest();

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("ownership");
      }
    });

    it("should skip if request is already done", async () => {
      await createTestEntry();
      await createTestRequest("done");

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
        expect(result.value.reason).toContain("terminal");
      }
    });

    it("should skip if request is already failed", async () => {
      await createTestEntry();
      await createTestRequest("failed");

      const result = await useCase.execute({ requestId, userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.processed).toBe(false);
        expect(result.value.status).toBe("skipped");
      }
    });

    it("should NOT call automation when skipped", async () => {
      await createTestRequest("done");

      await useCase.execute({ requestId, userId, entryId });

      expect(automationPort.getSentSummaryPayloads()).toHaveLength(0);
    });

    it("should NOT create notification when skipped", async () => {
      await createTestRequest("done");

      await useCase.execute({ requestId, userId, entryId });

      expect(notificationRepository.getAll()).toHaveLength(0);
    });
  });
});
