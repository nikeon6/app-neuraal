import { describe, it, expect } from "vitest";
import { TranscriptionRequest } from "./TranscriptionRequest";

describe("TranscriptionRequest", () => {
  const validProps = {
    id: "req-123",
    userId: "user-456",
    entryId: "entry-789",
    youtubeUrl: "https://www.youtube.com/watch?v=abc123",
    status: "pending",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  };

  describe("create", () => {
    it("should create a valid request with pending status", () => {
      const result = TranscriptionRequest.create(validProps);
      expect(result.isOk()).toBe(true);
      expect(result.value.id).toBe("req-123");
      expect(result.value.userId).toBe("user-456");
      expect(result.value.entryId).toBe("entry-789");
      expect(result.value.youtubeUrl).toBe(
        "https://www.youtube.com/watch?v=abc123"
      );
      expect(result.value.status.isPending()).toBe(true);
    });

    it("should create request with any valid status", () => {
      const result = TranscriptionRequest.create({
        ...validProps,
        status: "done",
      });
      expect(result.isOk()).toBe(true);
      expect(result.value.status.isDone()).toBe(true);
    });

    it("should trim whitespace from ids and url", () => {
      const result = TranscriptionRequest.create({
        ...validProps,
        id: "  req-123  ",
        userId: "  user-456  ",
        entryId: "  entry-789  ",
        youtubeUrl: "  https://youtube.com/watch?v=abc  ",
      });
      expect(result.isOk()).toBe(true);
      expect(result.value.id).toBe("req-123");
      expect(result.value.userId).toBe("user-456");
      expect(result.value.entryId).toBe("entry-789");
      expect(result.value.youtubeUrl).toBe(
        "https://youtube.com/watch?v=abc"
      );
    });

    it("should reject empty id", () => {
      const result = TranscriptionRequest.create({ ...validProps, id: "" });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request id cannot be empty");
    });

    it("should reject empty userId", () => {
      const result = TranscriptionRequest.create({
        ...validProps,
        userId: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request userId cannot be empty");
    });

    it("should reject empty entryId", () => {
      const result = TranscriptionRequest.create({
        ...validProps,
        entryId: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request entryId cannot be empty");
    });

    it("should reject empty youtubeUrl", () => {
      const result = TranscriptionRequest.create({
        ...validProps,
        youtubeUrl: "",
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Request youtubeUrl cannot be empty");
    });

    it("should reject invalid status", () => {
      const result = TranscriptionRequest.create({
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
      const request = TranscriptionRequest.createNew(
        "req-123",
        "user-456",
        "entry-789",
        "https://youtube.com/watch?v=abc"
      );
      expect(request.id).toBe("req-123");
      expect(request.userId).toBe("user-456");
      expect(request.entryId).toBe("entry-789");
      expect(request.youtubeUrl).toBe("https://youtube.com/watch?v=abc");
      expect(request.status.isPending()).toBe(true);
      expect(request.createdAt.getTime()).toBeGreaterThanOrEqual(
        now.getTime() - 1000
      );
    });
  });

  describe("state transitions", () => {
    it("should transition from pending to submitted", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        "https://youtube.com/watch?v=abc"
      );
      const submitted = request.markSubmitted();

      expect(submitted.status.isSubmitted()).toBe(true);
      expect(submitted.id).toBe(request.id);
      expect(submitted.youtubeUrl).toBe(request.youtubeUrl);
      expect(submitted.updatedAt.getTime()).toBeGreaterThanOrEqual(
        request.updatedAt.getTime()
      );
    });

    it("should transition to done", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        "https://youtube.com/watch?v=abc"
      );
      const done = request.markDone();
      expect(done.status.isDone()).toBe(true);
    });

    it("should transition to failed", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        "https://youtube.com/watch?v=abc"
      );
      const failed = request.markFailed();
      expect(failed.status.isFailed()).toBe(true);
    });
  });

  describe("isTerminal", () => {
    const url = "https://youtube.com/watch?v=abc";

    it("should return false for pending", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        url
      );
      expect(request.isTerminal()).toBe(false);
    });

    it("should return true for done", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        url
      );
      expect(request.markDone().isTerminal()).toBe(true);
    });

    it("should return true for failed", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        url
      );
      expect(request.markFailed().isTerminal()).toBe(true);
    });
  });

  describe("ownership", () => {
    it("should verify ownership correctly", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        "https://youtube.com/watch?v=abc"
      );
      expect(request.belongsTo("user-1")).toBe(true);
      expect(request.belongsTo("user-2")).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should return plain object representation", () => {
      const request = TranscriptionRequest.createNew(
        "req-1",
        "user-1",
        "entry-1",
        "https://youtube.com/watch?v=abc"
      );
      const json = request.toJSON();

      expect(json.id).toBe("req-1");
      expect(json.userId).toBe("user-1");
      expect(json.entryId).toBe("entry-1");
      expect(json.youtubeUrl).toBe("https://youtube.com/watch?v=abc");
      expect(json.status).toBe("pending");
      expect(json.createdAt).toBeInstanceOf(Date);
      expect(json.updatedAt).toBeInstanceOf(Date);
    });
  });
});
