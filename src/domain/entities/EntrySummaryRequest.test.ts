import { describe, it, expect } from "vitest";
import { EntrySummaryRequest } from "./EntrySummaryRequest";

describe("EntrySummaryRequest", () => {
  const validProps = {
    id: "req-123",
    userId: "user-456",
    entryId: "entry-789",
    status: "pending",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  };

  describe("create", () => {
    it("should create a valid request with pending status", () => {
      const result = EntrySummaryRequest.create(validProps);
      expect(result.isOk()).toBe(true);
      expect(result.value.id).toBe("req-123");
      expect(result.value.userId).toBe("user-456");
      expect(result.value.entryId).toBe("entry-789");
      expect(result.value.status.isPending()).toBe(true);
    });

    it("should create request with any valid status", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        status: "done",
      });
      expect(result.isOk()).toBe(true);
      expect(result.value.status.isDone()).toBe(true);
    });

    it("should trim whitespace from ids", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        id: "  req-123  ",
        userId: "  user-456  ",
        entryId: "  entry-789  ",
      });
      expect(result.isOk()).toBe(true);
      expect(result.value.id).toBe("req-123");
      expect(result.value.userId).toBe("user-456");
      expect(result.value.entryId).toBe("entry-789");
    });

    it("should reject empty id", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        id: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request id cannot be empty");
    });

    it("should reject empty userId", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        userId: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request userId cannot be empty");
    });

    it("should reject empty entryId", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        entryId: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request entryId cannot be empty");
    });

    it("should reject invalid status", () => {
      const result = EntrySummaryRequest.create({
        ...validProps,
        status: "invalid",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toContain("Invalid status");
    });
  });

  describe("createNew", () => {
    it("should create a new request with pending status", () => {
      const now = new Date();
      const request = EntrySummaryRequest.createNew(
        "req-123",
        "user-456",
        "entry-789",
      );
      expect(request.id).toBe("req-123");
      expect(request.userId).toBe("user-456");
      expect(request.entryId).toBe("entry-789");
      expect(request.status.isPending()).toBe(true);
      expect(request.createdAt.getTime()).toBeGreaterThanOrEqual(
        now.getTime() - 1000,
      );
    });
  });

  describe("state transitions", () => {
    it("should transition from pending to submitted", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      const submitted = request.markSubmitted();

      expect(submitted.status.isSubmitted()).toBe(true);
      expect(submitted.id).toBe(request.id);
      expect(submitted.updatedAt.getTime()).toBeGreaterThanOrEqual(
        request.updatedAt.getTime(),
      );
    });

    it("should transition to done", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      const done = request.markDone();

      expect(done.status.isDone()).toBe(true);
    });

    it("should transition to failed", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      const failed = request.markFailed();

      expect(failed.status.isFailed()).toBe(true);
    });
  });

  describe("isTerminal", () => {
    it("should return false for pending", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      expect(request.isTerminal()).toBe(false);
    });

    it("should return true for done", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      expect(request.markDone().isTerminal()).toBe(true);
    });

    it("should return true for failed", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      expect(request.markFailed().isTerminal()).toBe(true);
    });
  });

  describe("ownership", () => {
    it("should verify ownership correctly", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      expect(request.belongsTo("user-1")).toBe(true);
      expect(request.belongsTo("user-2")).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should return plain object representation", () => {
      const request = EntrySummaryRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
      );
      const json = request.toJSON();

      expect(json.id).toBe("req-1");
      expect(json.userId).toBe("user-1");
      expect(json.entryId).toBe("entry-1");
      expect(json.status).toBe("pending");
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(json.updatedAt).toBeInstanceOf(Date);
    });
  });
});
