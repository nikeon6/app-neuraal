import { describe, it, expect } from "vitest";
import { AiAction } from "./AiAction";

describe("AiAction", () => {
  describe("create", () => {
    it("accepts SUMMARY", () => {
      const result = AiAction.create("SUMMARY");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("SUMMARY");
      }
    });

    it("accepts TRANSCRIPT_YOUTUBE", () => {
      const result = AiAction.create("TRANSCRIPT_YOUTUBE");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("TRANSCRIPT_YOUTUBE");
      }
    });

    it("accepts OCR_IMAGE", () => {
      const result = AiAction.create("OCR_IMAGE");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("OCR_IMAGE");
      }
    });

    it("accepts REMINDER_WHATSAPP", () => {
      const result = AiAction.create("REMINDER_WHATSAPP");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("REMINDER_WHATSAPP");
      }
    });

    it("rejects unknown action", () => {
      const result = AiAction.create("UNKNOWN");
      expect(result.isErr()).toBe(true);
    });

    it("rejects empty string", () => {
      expect(AiAction.create("").isErr()).toBe(true);
    });

    it("normalizes case", () => {
      const result = AiAction.create("summary");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toBe("SUMMARY");
      }
    });
  });

  describe("factory methods", () => {
    it("summary() returns SUMMARY", () => {
      expect(AiAction.summary().toString()).toBe("SUMMARY");
    });
    it("transcriptYoutube() returns TRANSCRIPT_YOUTUBE", () => {
      expect(AiAction.transcriptYoutube().toString()).toBe(
        "TRANSCRIPT_YOUTUBE",
      );
    });
    it("ocrImage() returns OCR_IMAGE", () => {
      expect(AiAction.ocrImage().toString()).toBe("OCR_IMAGE");
    });
    it("reminderWhatsapp() returns REMINDER_WHATSAPP", () => {
      expect(AiAction.reminderWhatsapp().toString()).toBe("REMINDER_WHATSAPP");
    });
  });

  describe("equals", () => {
    it("returns true for same action", () => {
      expect(AiAction.summary().equals(AiAction.summary())).toBe(true);
    });
    it("returns false for different actions", () => {
      expect(AiAction.summary().equals(AiAction.ocrImage())).toBe(false);
    });
  });
});
