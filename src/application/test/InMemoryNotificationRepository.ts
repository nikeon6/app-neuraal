import { Notification } from "../../domain/entities/Notification";
import { NotificationRepository } from "../ports/NotificationRepository";

/**
 * In-memory implementation of NotificationRepository for testing.
 */
export class InMemoryNotificationRepository implements NotificationRepository {
  private notifications: Map<string, Notification> = new Map();

  async create(notification: Notification): Promise<void> {
    this.notifications.set(notification.id, notification);
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Notification | null> {
    const notification = this.notifications.get(id);
    if (!notification || notification.userId !== userId) {
      return null;
    }
    return notification;
  }

  async update(notification: Notification): Promise<void> {
    this.notifications.set(notification.id, notification);
  }

  async listByUserSince(userId: string, since: Date | null): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => {
        if (notification.userId !== userId) return false;
        if (since && notification.createdAt < since) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Test helpers
  clear(): void {
    this.notifications.clear();
  }

  getAll(): Notification[] {
    return Array.from(this.notifications.values());
  }
}
