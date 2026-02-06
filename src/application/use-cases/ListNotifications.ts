import { Result, ok } from "../../domain/core/Result";
import { Notification } from "../../domain/entities/Notification";
import { NotificationRepository } from "../ports/NotificationRepository";
import { NotificationDTO } from "../dto/NotificationDTO";
import { UseCaseError } from "../core/UseCaseError";

/**
 * Input for ListNotifications use case.
 */
export interface ListNotificationsInput {
  userId: string;
  since?: string | null;
}

/**
 * Use case: List notifications for a user.
 * Optionally filters by date since.
 */
export class ListNotifications {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(input: ListNotificationsInput): Promise<Result<NotificationDTO[], UseCaseError>> {
    const sinceDate = input.since ? new Date(input.since) : null;

    const notifications = await this.notificationRepository.listByUserSince(
      input.userId,
      sinceDate
    );

    return ok(notifications.map(this.toDTO));
  }

  private toDTO(notification: Notification): NotificationDTO {
    const json = notification.toJSON();
    return {
      id: json.id,
      userId: json.userId,
      type: json.type,
      title: json.title,
      message: json.message,
      status: json.status,
      payload: json.payload,
      createdAt: json.createdAt.toISOString(),
    };
  }
}
