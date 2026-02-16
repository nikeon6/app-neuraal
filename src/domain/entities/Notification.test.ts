import { describe, it, expect } from "vitest";
import { Notification } from "./Notification";

const TEST_NOTIF_ID = "notif-123";
const TEST_USER_ID = "user-123";

describe("Notification Entity", () => {
  const validProps = {
    id: TEST_NOTIF_ID,
    userId: TEST_USER_ID,
    type: "REMINDER_SENT",
    title: "Reminder Sent",
    message: "Your reminder was sent successfully",
    status: "unread",
    payload: { reminderId: "rem-123" },
    createdAt: new Date(),
  };

  describe("create", () => {
    it("should create a valid notification", () => {
      const result = Notification.create(validProps);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe(TEST_NOTIF_ID);
        expect(result.value.userId).toBe(TEST_USER_ID);
        expect(result.value.type.isReminderSent()).toBe(true);
        expect(result.value.title).toBe("Reminder Sent");
        expect(result.value.message).toBe(
          "Your reminder was sent successfully",
        );
        expect(result.value.status.isUnread()).toBe(true);
        expect(result.value.payload).toEqual({ reminderId: "rem-123" });
      }
    });

    it("should create notification with null payload", () => {
      const result = Notification.create({ ...validProps, payload: null });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.payload).toBeNull();
      }
    });

    it("should create REMINDER_FAILED notification", () => {
      const result = Notification.create({
        ...validProps,
        type: "REMINDER_FAILED",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type.isReminderFailed()).toBe(true);
      }
    });

    it("should create REMINDER_CANCELED notification", () => {
      const result = Notification.create({
        ...validProps,
        type: "REMINDER_CANCELED",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type.isReminderCanceled()).toBe(true);
      }
    });

    it("should reject empty id", () => {
      const result = Notification.create({ ...validProps, id: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("id cannot be empty");
      }
    });

    it("should reject empty userId", () => {
      const result = Notification.create({ ...validProps, userId: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("userId cannot be empty");
      }
    });

    it("should reject invalid type", () => {
      const result = Notification.create({
        ...validProps,
        type: "INVALID_TYPE",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid type");
      }
    });

    it("should reject empty title", () => {
      const result = Notification.create({ ...validProps, title: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("title cannot be empty");
      }
    });

    it("should reject empty message", () => {
      const result = Notification.create({ ...validProps, message: "" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("message cannot be empty");
      }
    });

    it("should reject invalid status", () => {
      const result = Notification.create({ ...validProps, status: "unknown" });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toContain("Invalid status");
      }
    });
  });

  describe("markRead", () => {
    it("should change status to read", () => {
      const notification = Notification.create(validProps).value;

      const readNotification = notification.markRead();

      expect(readNotification.status.isRead()).toBe(true);
      expect(readNotification.id).toBe(notification.id);
      expect(readNotification.title).toBe(notification.title);
    });
  });

  describe("toJSON", () => {
    it("should return plain object representation", () => {
      const notification = Notification.create(validProps).value;

      const json = notification.toJSON();

      expect(json.id).toBe(TEST_NOTIF_ID);
      expect(json.userId).toBe(TEST_USER_ID);
      expect(json.type).toBe("REMINDER_SENT");
      expect(json.title).toBe("Reminder Sent");
      expect(json.message).toBe("Your reminder was sent successfully");
      expect(json.status).toBe("unread");
      expect(json.payload).toEqual({ reminderId: "rem-123" });
    });
  });
});
