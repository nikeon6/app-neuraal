import { describe, it, expect } from "vitest";
import { SummaryText } from "./SummaryText";

describe("SummaryText", () => {
  describe("create", () => {
    it("should create a valid summary", () => {
      const result = SummaryText.create("This is a summary of the entry.");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("This is a summary of the entry.");
    });

    it("should accept minimum length summary (1 char)", () => {
      const result = SummaryText.create("A");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("A");
    });

    it("should accept maximum length summary (10000 chars)", () => {
      const longSummary = "x".repeat(10000);
      const result = SummaryText.create(longSummary);
      expect(result.isOk()).toBe(true);
      expect(result.value.toString().length).toBe(10000);
    });

    it("should trim whitespace", () => {
      const result = SummaryText.create("  trimmed summary  ");
      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe("trimmed summary");
    });

    it("should reject empty string", () => {
      const result = SummaryText.create("");
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Summary cannot be empty");
    });

    it("should reject whitespace-only string", () => {
      const result = SummaryText.create("   ");
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Summary cannot be empty");
    });

    it("should reject summary exceeding max length", () => {
      const tooLong = "x".repeat(10001);
      const result = SummaryText.create(tooLong);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Summary cannot exceed 10000 characters");
    });
  });

  describe("format", () => {
    it("should default to markdown format", () => {
      const result = SummaryText.create("# Title\nContent");
      expect(result.isOk()).toBe(true);
      expect(result.value.getFormat()).toBe("markdown");
    });

    it("should accept plain format", () => {
      const result = SummaryText.create("Plain text summary", "plain");
      expect(result.isOk()).toBe(true);
      expect(result.value.getFormat()).toBe("plain");
    });

    it("should accept markdown format explicitly", () => {
      const result = SummaryText.create("# Markdown", "markdown");
      expect(result.isOk()).toBe(true);
      expect(result.value.getFormat()).toBe("markdown");
    });

    it("should reject invalid format", () => {
      const result = SummaryText.create("text", "html" as "markdown" | "plain");
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe("Invalid format. Allowed: markdown, plain");
    });
  });

  describe("equals", () => {
    it("should return true for same text and format", () => {
      const summary1 = SummaryText.create("Same content", "markdown").value;
      const summary2 = SummaryText.create("Same content", "markdown").value;
      expect(summary1.equals(summary2)).toBe(true);
    });

    it("should return false for different text", () => {
      const summary1 = SummaryText.create("Content A", "markdown").value;
      const summary2 = SummaryText.create("Content B", "markdown").value;
      expect(summary1.equals(summary2)).toBe(false);
    });

    it("should return false for different format", () => {
      const summary1 = SummaryText.create("Same content", "markdown").value;
      const summary2 = SummaryText.create("Same content", "plain").value;
      expect(summary1.equals(summary2)).toBe(false);
    });
  });

  describe("isMarkdown / isPlain", () => {
    it("should correctly identify markdown format", () => {
      const summary = SummaryText.create("text", "markdown").value;
      expect(summary.isMarkdown()).toBe(true);
      expect(summary.isPlain()).toBe(false);
    });

    it("should correctly identify plain format", () => {
      const summary = SummaryText.create("text", "plain").value;
      expect(summary.isMarkdown()).toBe(false);
      expect(summary.isPlain()).toBe(true);
    });
  });

  describe("length", () => {
    it("should return correct length", () => {
      const summary = SummaryText.create("Hello World").value;
      expect(summary.length()).toBe(11);
    });
  });
});
