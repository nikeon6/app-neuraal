import { describe, it, expect } from "vitest";
import { RequestStatus } from "./RequestStatus";

describe("RequestStatus", () => {
  describe("create", () => {
    it("should create a valid pending status", () => {
      const result = RequestStatus.create("pending");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("pending");
    });

    it("should create a valid submitted status", () => {
      const result = RequestStatus.create("submitted");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("submitted");
    });

    it("should create a valid done status", () => {
      const result = RequestStatus.create("done");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("done");
    });

    it("should create a valid failed status", () => {
      const result = RequestStatus.create("failed");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("failed");
    });

    it("should normalize case", () => {
      const result = RequestStatus.create("PENDING");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("pending");
    });

    it("should trim whitespace", () => {
      const result = RequestStatus.create("  done  ");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("done");
    });

    it("should reject empty string", () => {
      const result = RequestStatus.create("");
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Status cannot be empty");
    });

    it("should reject invalid status", () => {
      const result = RequestStatus.create("invalid");
      expect(result.isErr()).toBe(true);
      expect(result.error).toContain("Invalid status");
    });
  });

  describe("factory methods", () => {
    it("should create pending status", () => {
      const status = RequestStatus.pending();
      expect(status.isPending()).toBe(true);
      expect(status.toString()).toBe("pending");
    });

    it("should create submitted status", () => {
      const status = RequestStatus.submitted();
      expect(status.isSubmitted()).toBe(true);
      expect(status.toString()).toBe("submitted");
    });

    it("should create done status", () => {
      const status = RequestStatus.done();
      expect(status.isDone()).toBe(true);
      expect(status.toString()).toBe("done");
    });

    it("should create failed status", () => {
      const status = RequestStatus.failed();
      expect(status.isFailed()).toBe(true);
      expect(status.toString()).toBe("failed");
    });
  });

  describe("state checks", () => {
    it("pending status should only return true for isPending", () => {
      const status = RequestStatus.pending();
      expect(status.isPending()).toBe(true);
      expect(status.isSubmitted()).toBe(false);
      expect(status.isDone()).toBe(false);
      expect(status.isFailed()).toBe(false);
    });

    it("done status should only return true for isDone", () => {
      const status = RequestStatus.done();
      expect(status.isPending()).toBe(false);
      expect(status.isSubmitted()).toBe(false);
      expect(status.isDone()).toBe(true);
      expect(status.isFailed()).toBe(false);
    });
  });

  describe("equals", () => {
    it("should return true for same status", () => {
      const status1 = RequestStatus.pending();
      const status2 = RequestStatus.pending();
      expect(status1.equals(status2)).toBe(true);
    });

    it("should return false for different status", () => {
      const status1 = RequestStatus.pending();
      const status2 = RequestStatus.done();
      expect(status1.equals(status2)).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("should return false for pending", () => {
      expect(RequestStatus.pending().isTerminal()).toBe(false);
    });

    it("should return false for submitted", () => {
      expect(RequestStatus.submitted().isTerminal()).toBe(false);
    });

    it("should return true for done", () => {
      expect(RequestStatus.done().isTerminal()).toBe(true);
    });

    it("should return true for failed", () => {
      expect(RequestStatus.failed().isTerminal()).toBe(true);
    });
  });
});
