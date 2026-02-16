import { describe, it, expect } from "vitest";
import { Reminder } from "./Reminder";

describe("Reminder Entity", () => {
  const validProps = {
    id: "rem-123",
    userId: "user-123",
    entryId: "entry-123",
    scheduledAt: "2026-02-10T18:30:00.000Z",
    channel: "whatsapp",
    message: "Don't forget!",
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("create", () => {
    it("should create a valid reminder", () => {
      const result = Reminder.create(validProps);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe("rem-123");
        expect(result.value.userId).toBe("user-123");
        expect(result.value.entryId).toBe("entry-123");
        expect(result.value.channel.toString()).toBe("whatsapp");
        expect(result.value.message).toBe("Don't forget!");
        expect(result.value.status.isPending()).toBe(true);
      }
    });

    it("should create a reminder with null message", () => {
      const result = Reminder.create({ ...validProps, message: null });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.message).toBeNull();
      }
    });

    it("should reject empty id", () => {
      const result = Reminder.create({ ...validProps, id: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("id cannot be empty");
      }
    });

    it("should reject empty userId", () => {
      const result = Reminder.create({ ...validProps, userId: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("userId cannot be empty");
      }
    });

    it("should reject empty entryId", () => {
      const result = Reminder.create({ ...validProps, entryId: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("entryId cannot be empty");
      }
    });

    it("should reject invalid scheduledAt", () => {
      const result = Reminder.create({
        ...validProps,
        scheduledAt: "not-a-date",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid");
      }
    });

    it("should reject invalid channel", () => {
      const result = Reminder.create({
        ...validProps,
        channel: "carrier-pigeon",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid channel");
      }
    });

    it("should reject invalid status", () => {
      const result = Reminder.create({ ...validProps, status: "unknown" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid status");
      }
    });

    it("should accept Date object for scheduledAt", () => {
      const result = Reminder.create({
        ...validProps,
        scheduledAt: new Date("2026-02-10T18:30:00.000Z"),
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe("canModify", () => {
    it("should return true for pending status", () => {
      const result = Reminder.create({ ...validProps, status: "pending" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.canModify()).toBe(true);
      }
    });

    it("should return false for sent status", () => {
      const result = Reminder.create({ ...validProps, status: "sent" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.canModify()).toBe(false);
      }
    });

    it("should return false for canceled status", () => {
      const result = Reminder.create({ ...validProps, status: "canceled" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.canModify()).toBe(false);
      }
    });

    it("should return false for failed status", () => {
      const result = Reminder.create({ ...validProps, status: "failed" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.canModify()).toBe(false);
      }
    });
  });

  describe("withUpdates", () => {
    it("should update scheduledAt for pending reminder", () => {
      const reminder = Reminder.create(validProps).value;
      const newDate = "2026-02-15T10:00:00.000Z";

      const result = reminder.withUpdates({ scheduledAt: newDate });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.scheduledAt.toString()).toBe(newDate);
      }
    });

    it("should update channel for pending reminder", () => {
      const reminder = Reminder.create(validProps).value;

      const result = reminder.withUpdates({ channel: "email" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.channel.toString()).toBe("email");
      }
    });

    it("should update message for pending reminder", () => {
      const reminder = Reminder.create(validProps).value;

      const result = reminder.withUpdates({ message: "New message" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.message).toBe("New message");
      }
    });

    it("should cancel pending reminder", () => {
      const reminder = Reminder.create(validProps).value;

      const result = reminder.withUpdates({ status: "canceled" });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status.isCanceled()).toBe(true);
      }
    });

    it("should reject updates for sent reminder", () => {
      const reminder = Reminder.create({ ...validProps, status: "sent" }).value;

      const result = reminder.withUpdates({ message: "New message" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Cannot modify");
      }
    });

    it("should reject updates for canceled reminder", () => {
      const reminder = Reminder.create({
        ...validProps,
        status: "canceled",
      }).value;

      const result = reminder.withUpdates({ message: "New message" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Cannot modify");
      }
    });
  });

  describe("markSent", () => {
    it("should change status to sent", () => {
      const reminder = Reminder.create(validProps).value;

      const sentReminder = reminder.markSent();

      expect(sentReminder.status.isSent()).toBe(true);
      expect(sentReminder.id).toBe(reminder.id);
    });
  });

  describe("markFailed", () => {
    it("should change status to failed", () => {
      const reminder = Reminder.create(validProps).value;

      const failedReminder = reminder.markFailed();

      expect(failedReminder.status.isFailed()).toBe(true);
      expect(failedReminder.id).toBe(reminder.id);
    });
  });

  describe("toJSON", () => {
    it("should return plain object representation", () => {
      const reminder = Reminder.create(validProps).value;

      const json = reminder.toJSON();

      expect(json.id).toBe("rem-123");
      expect(json.userId).toBe("user-123");
      expect(json.entryId).toBe("entry-123");
      expect(json.channel).toBe("whatsapp");
      expect(json.message).toBe("Don't forget!");
      expect(json.status).toBe("pending");
      expect(typeof json.scheduledAt).toBe("string");
    });
  });
});
