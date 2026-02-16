import { Result, ok, err } from "../../../domain/core/Result";
import { Reminder } from "../../../domain/entities/Reminder";
import { ISODateTime } from "../../../domain/value-objects/ISODateTime";
import { ReminderRepository } from "../../ports/ReminderRepository";
import { QueuePort } from "../../ports/QueuePort";
import { UpdateReminderDTO, ReminderDTO } from "../../dto/ReminderDTO";
import {
  UseCaseError,
  validationError,
  notFoundError,
  conflictError,
} from "../../core/UseCaseError";

/**
 * Input for UpdateReminder use case.
 */
export interface UpdateReminderInput extends UpdateReminderDTO {
  userId: string;
  reminderId: string;
}

/**
 * Use case: Update a reminder (reschedule, change channel, cancel).
 * Validates:
 * - Reminder exists and belongs to user
 * - Reminder is in pending status
 * - If rescheduling, new scheduledAt is in the future
 */
export class UpdateReminder {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly queuePort: QueuePort,
  ) {}

  async execute(
    input: UpdateReminderInput,
  ): Promise<Result<ReminderDTO, UseCaseError>> {
    // Find reminder with ownership check
    const reminder = await this.reminderRepository.findByIdForUser(
      input.reminderId,
      input.userId,
    );

    if (!reminder) {
      return err(notFoundError("Reminder not found"));
    }

    // Check if can modify (must be pending)
    if (!reminder.canModify()) {
      return err(
        conflictError(
          `Cannot modify reminder with status: ${reminder.status.toString()}`,
        ),
      );
    }

    // Validate scheduledAt if provided
    if (input.scheduledAt !== undefined) {
      const scheduledAtResult = ISODateTime.create(input.scheduledAt);
      if (scheduledAtResult.isErr()) {
        return err(validationError(scheduledAtResult.error));
      }

      if (!scheduledAtResult.value.isFuture(2000)) {
        return err(validationError("scheduledAt must be in the future"));
      }
    }

    // Apply updates
    const updateResult = reminder.withUpdates({
      scheduledAt: input.scheduledAt,
      channel: input.channel,
      message: input.message,
      status: input.status,
    });

    if (updateResult.isErr()) {
      return err(validationError(updateResult.error));
    }

    const updatedReminder = updateResult.value;

    // Save to database
    await this.reminderRepository.update(updatedReminder);

    // If rescheduled (not canceled), enqueue new job
    // The worker will revalidate scheduledAt from DB
    if (input.scheduledAt && !input.status) {
      await this.queuePort.enqueueReminder({
        reminderId: updatedReminder.id,
        scheduledAt: updatedReminder.scheduledAt.toString(),
      });
    }

    // Return DTO
    return ok(this.toDTO(updatedReminder));
  }

  private toDTO(reminder: Reminder): ReminderDTO {
    const json = reminder.toJSON();
    return {
      id: json.id,
      userId: json.userId,
      entryId: json.entryId,
      scheduledAt: json.scheduledAt,
      channel: json.channel,
      message: json.message,
      status: json.status,
      createdAt: json.createdAt.toISOString(),
      updatedAt: json.updatedAt.toISOString(),
    };
  }
}
