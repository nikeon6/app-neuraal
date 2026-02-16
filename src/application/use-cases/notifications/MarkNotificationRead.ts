import { Result, ok, err } from "../../../domain/core/Result";
import { NotificationRepository } from "../../ports/NotificationRepository";
import { UseCaseError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for MarkNotificationRead use case.
 */
export interface MarkNotificationReadInput {
  userId: string;
  notificationId: string;
}

/**
 * Use case: Mark a notification as read.
 */
export class MarkNotificationRead {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(
    input: MarkNotificationReadInput,
  ): Promise<Result<void, UseCaseError>> {
    // Find notification with ownership check
    const notification = await this.notificationRepository.findByIdForUser(
      input.notificationId,
      input.userId,
    );

    if (!notification) {
      return err(notFoundError("Notification not found"));
    }

    // Mark as read
    const readNotification = notification.markRead();

    // Save to database
    await this.notificationRepository.update(readNotification);

    return ok(undefined);
  }
}
