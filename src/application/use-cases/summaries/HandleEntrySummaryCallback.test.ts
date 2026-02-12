import { describe, it, expect, beforeEach } from "vitest";
import { HandleEntrySummaryCallback } from "./HandleEntrySummaryCallback";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { InMemorySummaryRequestRepository } from "../../test/InMemorySummaryRequestRepository";
import { Entry } from "../../../domain/entities/Entry";
import { EntrySummaryRequest } from "../../../domain/entities/EntrySummaryRequest";
import crypto from "crypto";

describe("HandleEntrySummaryCallback", () => {
  let entryRepository: InMemoryEntryRepository;
  let notificationRepository: InMemoryNotificationRepository;
  let summaryRequestRepository: InMemorySummaryRequestRepository;
  let useCase: HandleEntrySummaryCallback;

  const webhookSecret = "test-webhook-secret";
  const userId = "user-123";
  const entryId = "entry-456";
  const requestId = "request-789";

  const createTestEntry = async () => {
    const entryResult = Entry.create({
      id: entryId,
      userId,
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

  const createTestRequest = async (status: string = "submitted") => {
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

  const generateSignature = (
    timestamp: string,
    body: string,
    secret: string = webhookSecret
  ): string => {
    const payload = `${timestamp}.${body}`;
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  };

  beforeEach(() => {
    entryRepository = new InMemoryEntryRepository();
    notificationRepository = new InMemoryNotificationRepository();
    summaryRequestRepository = new InMemorySummaryRequestRepository();
    useCase = new HandleEntrySummaryCallback(
      entryRepository,
      summaryRequestRepository,
      notificationRepository,
      webhookSecret,
      undefined, // recordAiUsage not needed for these tests
      () => "test-notif-id"
    );
  });

  describe("signature validation", () => {
    it("should reject invalid signature", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const body = JSON.stringify({
        requestId,
        userId,
        entryId,
        summary: "Test summary",
        format: "markdown",
      });

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature: "invalid-signature",
        payload: JSON.parse(body),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.message).toContain("Invalid signature");
      }
    });

    it("should reject expired timestamp (> 5 minutes)", async () => {
      await createTestEntry();
      await createTestRequest();

      const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago
      const body = JSON.stringify({
        requestId,
        userId,
        entryId,
        summary: "Test summary",
        format: "markdown",
      });
      const signature = generateSignature(oldTimestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp: oldTimestamp,
        signature,
        payload: JSON.parse(body),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.message).toContain("expired");
      }
    });

    it("should accept valid signature", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const body = JSON.stringify({
        requestId,
        userId,
        entryId,
        summary: "Test summary",
        format: "markdown",
      });
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload: JSON.parse(body),
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe("successful callback processing", () => {
    it("should update entry with summary", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "This is the AI-generated summary.",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      const entrySummary = entryRepository.getSummary(entryId);
      expect(entrySummary?.summary).toBe("This is the AI-generated summary.");
      expect(entrySummary?.format).toBe("markdown");
    });

    it("should mark request as done", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "Summary text",
        format: "plain" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      const request = await summaryRequestRepository.findById(requestId);
      expect(request?.status.isDone()).toBe(true);
    });

    it("should create SUMMARY_DONE notification", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "Summary text",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      const notifications = notificationRepository.getAll();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type.isSummaryDone()).toBe(true);
      expect(notifications[0].userId).toBe(userId);
    });
  });

  describe("idempotency", () => {
    it("should not duplicate effects if request already done", async () => {
      await createTestEntry();
      await createTestRequest("done"); // Already completed

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "Summary text",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.alreadyProcessed).toBe(true);
      }

      // Should not create new notification
      expect(notificationRepository.getAll()).toHaveLength(0);
    });
  });

  describe("validation errors", () => {
    it("should return NOT_FOUND if request does not exist", async () => {
      await createTestEntry();

      const timestamp = Date.now().toString();
      const payload = {
        requestId: "non-existent",
        userId,
        entryId,
        summary: "Summary text",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("should reject if userId in callback doesn't match request", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId: "different-user", // Wrong user
        entryId,
        summary: "Summary text",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.message).toContain("mismatch");
      }
    });

    it("should reject mismatched entryId in payload", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId: "different-entry-id", // Does not match the request's entryId
        summary: "Summary text",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("Entry ID mismatch");
      }
    });

    it("should reject invalid summary format", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "Summary text",
        format: "html" as "markdown" | "plain", // Invalid format
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject empty summary", async () => {
      await createTestEntry();
      await createTestRequest();

      const timestamp = Date.now().toString();
      const payload = {
        requestId,
        userId,
        entryId,
        summary: "",
        format: "markdown" as const,
      };
      const body = JSON.stringify(payload);
      const signature = generateSignature(timestamp, body);

      const result = await useCase.execute({
        rawBody: body,
        timestamp,
        signature,
        payload,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
