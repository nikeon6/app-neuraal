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

    it("rejects unknown action", () => {
      const result = AiAction.create("UNKNOWN");
      expect(result.isErr()).toBe(true);
    });

    it("rejects empty string", () => {
      expect(AiAction.create("").isErr()).toBe(true);
    });
  });

  describe("summary", () => {
    it("returns SUMMARY action", () => {
      const action = AiAction.summary();
      expect(action.toString()).toBe("SUMMARY");
    });
  });
});
