import { describe, it, expect, beforeEach } from "vitest";
import { MarkNotificationRead } from "./MarkNotificationRead";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { Notification } from "../../../domain/entities/Notification";

describe("MarkNotificationRead", () => {
  let notificationRepository: InMemoryNotificationRepository;
  let markNotificationRead: MarkNotificationRead;

  const userId = "user-123";
  const notificationId = "notif-123";

  const createNotification = async (
    status: string = "unread",
    userIdOverride?: string,
  ) => {
    const notificationResult = Notification.create({
      id: notificationId,
      userId: userIdOverride ?? userId,
      type: "REMINDER_SENT",
      title: "Reminder Sent",
      message: "Your reminder was sent",
      status,
      payload: { reminderId: "rem-123" },
      createdAt: new Date(),
    });
    await notificationRepository.create(notificationResult.value);
    return notificationResult.value;
  };

  beforeEach(() => {
    notificationRepository = new InMemoryNotificationRepository();
    markNotificationRead = new MarkNotificationRead(notificationRepository);
  });

  it("should mark notification as read", async () => {
    await createNotification("unread");

    const result = await markNotificationRead.execute({
      userId,
      notificationId,
    });

    expect(result.isOk()).toBe(true);
  });

  it("should update notification status in repository", async () => {
    await createNotification("unread");

    await markNotificationRead.execute({
      userId,
      notificationId,
    });

    const notification = await notificationRepository.findById(notificationId);
    expect(notification?.status.isRead()).toBe(true);
  });

  it("should succeed even if already read", async () => {
    await createNotification("read");

    const result = await markNotificationRead.execute({
      userId,
      notificationId,
    });

    expect(result.isOk()).toBe(true);
  });

  it("should return not found if notification does not exist", async () => {
    const result = await markNotificationRead.execute({
      userId,
      notificationId: "non-existent",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("should return not found if notification belongs to different user", async () => {
    await createNotification("unread", "other-user");

    const result = await markNotificationRead.execute({
      userId,
      notificationId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
