import { describe, it, expect, beforeEach } from "vitest";
import { RequestEntrySummary } from "./RequestEntrySummary";
import { InMemoryEntryRepository } from "../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../test/InMemoryNotificationRepository";
import { InMemorySummaryRequestRepository } from "../test/InMemorySummaryRequestRepository";
import { FakeQueuePort } from "../test/FakeQueuePort";
import { Entry } from "../../domain/entities/Entry";

describe("RequestEntrySummary", () => {
  let entryRepository: InMemoryEntryRepository;
  let notificationRepository: InMemoryNotificationRepository;
  let summaryRequestRepository: InMemorySummaryRequestRepository;
  let queuePort: FakeQueuePort;
  let useCase: RequestEntrySummary;

  const userId = "user-123";
  const entryId = "entry-456";

  const createTestEntry = async (
    ownerId: string = userId,
    id: string = entryId
  ) => {
    const entryResult = Entry.create({
      id,
      userId: ownerId,
      date: "2026-01-15",
      type: "note",
      title: "Test Entry",
      content: { text: "This is test content that needs summarizing." },
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await entryRepository.save(entryResult.value);
    return entryResult.value;
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    notificationRepository = new InMemoryNotificationRepository();
    summaryRequestRepository = new InMemorySummaryRequestRepository();
    queuePort = new FakeQueuePort();
    useCase = new RequestEntrySummary(
      entryRepository,
      notificationRepository,
      summaryRequestRepository,
      queuePort,
      () => "test-request-id",
      () => "test-notif-id"
    );
  });

  describe("successful request", () => {
    it("should create summary request and return 202 Accepted data", async () => {
      await createTestEntry();

      const result = await useCase.execute({ userId, entryId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.requestId).toBe("test-request-id");
        expect(result.value.notificationId).toBe("test-notif-id");
      }
    });

    it("should create EntrySummaryRequest with pending status", async () => {
      await createTestEntry();

      await useCase.execute({ userId, entryId });

      const requests = summaryRequestRepository.getAll();
      expect(requests).toHaveLength(1);
      expect(requests[0].id).toBe("test-request-id");
      expect(requests[0].userId).toBe(userId);
      expect(requests[0].entryId).toBe(entryId);
      expect(requests[0].status.isPending()).toBe(true);
    });

    it("should create SUMMARY_IN_PROGRESS notification", async () => {
      await createTestEntry();

      await useCase.execute({ userId, entryId });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].id).toBe("test-notif-id");
      expect(notifications[0].userId).toBe(userId);
      expect(notifications[0].type.isSummaryInProgress()).toBe(true);
      expect(notifications[0].status.isUnread()).toBe(true);
    });

    it("should enqueue summary job", async () => {
      await createTestEntry();

      await useCase.execute({ userId, entryId });

      const jobs = queuePort.getEnqueuedSummaryJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].requestId).toBe("test-request-id");
      expect(jobs[0].userId).toBe(userId);
      expect(jobs[0].entryId).toBe(entryId);
    });
  });

  describe("error scenarios", () => {
    it("should return NOT_FOUND if entry does not exist", async () => {
      const result = await useCase.execute({ userId, entryId: "non-existent" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("Entry not found");
      }
    });

    it("should return NOT_FOUND if entry belongs to different user", async () => {
      await createTestEntry("other-user");

      const result = await useCase.execute({ userId, entryId });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should NOT create request or notification if entry not found", async () => {
      await useCase.execute({ userId, entryId: "non-existent" });

      expect(summaryRequestRepository.getAll()).toHaveLength(0);
      expect(notificationRepository.getAll()).toHaveLength(0);
    });

    it("should NOT enqueue job if entry not found", async () => {
      await useCase.execute({ userId, entryId: "non-existent" });

      expect(queuePort.getEnqueuedSummaryJobs()).toHaveLength(0);
    });
  });

  describe("duplicate request handling", () => {
    it("should return CONFLICT if there is already an active request", async () => {
      await createTestEntry();
      // First request succeeds
      await useCase.execute({ userId, entryId });

      // Second request should fail
      const result = await useCase.execute({ userId, entryId });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain("already in progress");
      }
    });

    it("should allow new request after previous one completed (done)", async () => {
      await createTestEntry();
      await useCase.execute({ userId, entryId });

      // Mark the first request as done
      const request = (await summaryRequestRepository.findById("test-request-id"))!;
      await summaryRequestRepository.update(request.markDone());

      // Create a new use case with a different ID generator
      let callCount = 0;
      const useCaseWithNewId = new RequestEntrySummary(
        entryRepository,
        notificationRepository,
        summaryRequestRepository,
        queuePort,
        () => `request-${++callCount}`,
        () => `notif-${callCount}`
      );

      // New request should succeed
      const result = await useCaseWithNewId.execute({ userId, entryId });
      expect(result.isOk()).toBe(true);
    });

    it("should allow new request after previous one failed", async () => {
      await createTestEntry();
      await useCase.execute({ userId, entryId });

      // Mark the first request as failed
      const request = (await summaryRequestRepository.findById("test-request-id"))!;
      await summaryRequestRepository.update(request.markFailed());

      // Create a new use case with a different ID generator
      let callCount = 0;
      const useCaseWithNewId = new RequestEntrySummary(
        entryRepository,
        notificationRepository,
        summaryRequestRepository,
        queuePort,
        () => `request-${++callCount}`,
        () => `notif-${callCount}`
      );

      const result = await useCaseWithNewId.execute({ userId, entryId });
      expect(result.isOk()).toBe(true);
    });
  });
});
