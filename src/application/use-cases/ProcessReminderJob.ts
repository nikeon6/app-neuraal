import { Result, ok, err } from "../../domain/core/Result";
import { Notification } from "../../domain/entities/Notification";
import { ReminderRepository } from "../ports/ReminderRepository";
import { NotificationRepository } from "../ports/NotificationRepository";
import { AutomationPort } from "../ports/AutomationPort";
import { UseCaseError, notFoundError, internalError } from "../core/UseCaseError";

/**
 * Input for ProcessReminderJob use case.
 */
export interface ProcessReminderJobInput {
  reminderId: string;
  originalScheduledAt: string;
}

/**
 * Result of processing a reminder job.
 */
export interface ProcessReminderJobResult {
  processed: boolean;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

/**
 * Use case: Process a reminder job from the queue.
 * 
 * Logic:
 * 1. Load reminder from DB
 * 2. If not found → skip (was deleted)
 * 3. If status != pending → skip (already processed or canceled)
 * 4. If scheduledAt changed → skip (was rescheduled)
 * 5. Call automation service (n8n)
 * 6. If success → mark sent, create REMINDER_SENT notification
 * 7. If failure → mark failed, create REMINDER_FAILED notification
 */
export class ProcessReminderJob {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly automationPort: AutomationPort,
    private readonly generateId: () => string = () => crypto.randomUUID()
  ) {}

  async execute(input: ProcessReminderJobInput): Promise<Result<ProcessReminderJobResult, UseCaseError>> {
    // 1. Load reminder
    const reminder = await this.reminderRepository.findById(input.reminderId);

    // 2. If not found, skip
    if (!reminder) {
      return ok({
        processed: false,
        status: "skipped",
        reason: "Reminder not found (deleted)",
      });
    }

    // 3. If not pending, skip
    if (!reminder.status.isPending()) {
      return ok({
        processed: false,
        status: "skipped",
        reason: `Reminder status is ${reminder.status.toString()}, not pending`,
      });
    }

    // 4. If scheduledAt changed (was rescheduled), skip
    if (reminder.scheduledAt.toString() !== input.originalScheduledAt) {
      return ok({
        processed: false,
        status: "skipped",
        reason: "Reminder was rescheduled",
      });
    }

    // 5. Call automation service
    const automationResult = await this.automationPort.sendReminder({
      reminderId: reminder.id,
      userId: reminder.userId,
      entryId: reminder.entryId,
      scheduledAt: reminder.scheduledAt.toString(),
      channel: reminder.channel.toString(),
      message: reminder.message,
    });

    const now = new Date();

    if (automationResult.success) {
      // 6. Success → mark sent
      const sentReminder = reminder.markSent();
      await this.reminderRepository.update(sentReminder);

      // Create success notification
      const notificationResult = Notification.create({
        id: this.generateId(),
        userId: reminder.userId,
        type: "REMINDER_SENT",
        title: "Reminder Sent",
        message: `Your reminder was sent via ${reminder.channel.toString()}`,
        status: "unread",
        payload: { reminderId: reminder.id, entryId: reminder.entryId },
        createdAt: now,
      });

      if (notificationResult.isOk()) {
        await this.notificationRepository.create(notificationResult.value);
      }

      return ok({
        processed: true,
        status: "sent",
      });
    } else {
      // 7. Failure → mark failed
      const failedReminder = reminder.markFailed();
      await this.reminderRepository.update(failedReminder);

      // Create failure notification
      const notificationResult = Notification.create({
        id: this.generateId(),
        userId: reminder.userId,
        type: "REMINDER_FAILED",
        title: "Reminder Failed",
        message: `Failed to send reminder via ${reminder.channel.toString()}: ${automationResult.error || "Unknown error"}`,
        status: "unread",
        payload: { 
          reminderId: reminder.id, 
          entryId: reminder.entryId,
          error: automationResult.error,
        },
        createdAt: now,
      });

      if (notificationResult.isOk()) {
        await this.notificationRepository.create(notificationResult.value);
      }

      return ok({
        processed: true,
        status: "failed",
        reason: automationResult.error,
      });
    }
  }
}
