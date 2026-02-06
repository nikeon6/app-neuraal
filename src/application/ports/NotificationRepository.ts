import { Notification } from "../../domain/entities/Notification";

/**
 * Port for Notification persistence.
 */
export interface NotificationRepository {
  /**
   * Creates a new notification.
   */
  create(notification: Notification): Promise<void>;

  /**
   * Finds a notification by ID.
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Finds a notification by ID and userId (ownership check).
   * Returns null if not found OR not owned by user.
   */
  findByIdForUser(id: string, userId: string): Promise<Notification | null>;

  /**
   * Updates an existing notification.
   */
  update(notification: Notification): Promise<void>;

  /**
   * Lists notifications for a user since a given date.
   * If since is null, returns all notifications.
   */
  listByUserSince(userId: string, since: Date | null): Promise<Notification[]>;
}
