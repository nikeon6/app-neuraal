import { describe, it, expect, beforeEach } from "vitest";
import { ListNotifications } from "./ListNotifications";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { Notification } from "../../../domain/entities/Notification";

describe("ListNotifications", () => {
  let notificationRepository: InMemoryNotificationRepository;
  let listNotifications: ListNotifications;

  const userId = "user-123";

  const createNotification = async (
    id: string,
    createdAt: Date,
    userIdOverride?: string
  ) => {
    const notificationResult = Notification.create({
      id,
      userId: userIdOverride ?? userId,
      type: "REMINDER_SENT",
      title: "Reminder Sent",
      message: "Your reminder was sent",
      status: "unread",
      payload: { reminderId: "rem-123" },
      createdAt,
    });
    await notificationRepository.create(notificationResult.value);
    return notificationResult.value;
  };

  beforeEach(() => {
    notificationRepository = new InMemoryNotificationRepository();
    listNotifications = new ListNotifications(notificationRepository);
  });

  it("should list all notifications for user", async () => {
    await createNotification("notif-1", new Date("2026-02-05T10:00:00.000Z"));
    await createNotification("notif-2", new Date("2026-02-05T11:00:00.000Z"));

    const result = await listNotifications.execute({ userId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
    }
  });

  it("should return empty array for user with no notifications", async () => {
    const result = await listNotifications.execute({ userId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should only return notifications for the specified user", async () => {
    await createNotification("notif-1", new Date("2026-02-05T10:00:00.000Z"), userId);
    await createNotification("notif-2", new Date("2026-02-05T11:00:00.000Z"), "other-user");

    const result = await listNotifications.execute({ userId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe("notif-1");
    }
  });

  it("should filter by since date", async () => {
    await createNotification("notif-1", new Date("2026-02-04T10:00:00.000Z"));
    await createNotification("notif-2", new Date("2026-02-05T11:00:00.000Z"));
    await createNotification("notif-3", new Date("2026-02-06T12:00:00.000Z"));

    const result = await listNotifications.execute({
      userId,
      since: "2026-02-05T00:00:00.000Z",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
      expect(result.value.map((n) => n.id)).toContain("notif-2");
      expect(result.value.map((n) => n.id)).toContain("notif-3");
    }
  });

  it("should return notifications sorted by createdAt descending", async () => {
    await createNotification("notif-1", new Date("2026-02-05T10:00:00.000Z"));
    await createNotification("notif-2", new Date("2026-02-05T12:00:00.000Z"));
    await createNotification("notif-3", new Date("2026-02-05T11:00:00.000Z"));

    const result = await listNotifications.execute({ userId });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0].id).toBe("notif-2"); // Most recent first
      expect(result.value[1].id).toBe("notif-3");
      expect(result.value[2].id).toBe("notif-1");
    }
  });
});
