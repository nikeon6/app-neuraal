import { Result, ok, err } from "../../../domain/core/Result";
import { Reminder } from "../../../domain/entities/Reminder";
import { ISODateTime } from "../../../domain/value-objects/ISODateTime";
import { ReminderRepository } from "../../ports/ReminderRepository";
import { EntryRepository } from "../../ports/EntryRepository";
import { QueuePort } from "../../ports/QueuePort";
import { CreateReminderDTO, ReminderDTO } from "../../dto/ReminderDTO";
import { UseCaseError, validationError, notFoundError } from "../../core/UseCaseError";

/**
 * Input for CreateReminder use case.
 */
export interface CreateReminderInput extends CreateReminderDTO {
  userId: string;
}

/**
 * Use case: Create a reminder for an entry.
 * Validates:
 * - Entry exists and belongs to user
 * - scheduledAt is in the future (with 2s tolerance)
 * - Channel is valid
 * Then saves to DB and enqueues job.
 */
export class CreateReminder {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly entryRepository: EntryRepository,
    private readonly queuePort: QueuePort,
    private readonly generateId: () => string = () => crypto.randomUUID()
  ) {}

  async execute(input: CreateReminderInput): Promise<Result<ReminderDTO, UseCaseError>> {
    // Validate entry ownership
    const entry = await this.entryRepository.findById(input.entryId);
    if (!entry || entry.userId !== input.userId) {
      return err(notFoundError("Entry not found"));
    }

    // Validate scheduledAt is in the future
    const scheduledAtResult = ISODateTime.create(input.scheduledAt);
    if (scheduledAtResult.isErr()) {
      return err(validationError(scheduledAtResult.error));
    }

    const scheduledAt = scheduledAtResult.value;
    if (!scheduledAt.isFuture(2000)) {
      return err(validationError("scheduledAt must be in the future"));
    }

    // Create reminder entity
    const now = new Date();
    const reminderId = this.generateId();

    const reminderResult = Reminder.create({
      id: reminderId,
      userId: input.userId,
      entryId: input.entryId,
      scheduledAt: input.scheduledAt,
      channel: input.channel,
      message: input.message ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    if (reminderResult.isErr()) {
      return err(validationError(reminderResult.error));
    }

    const reminder = reminderResult.value;

    // Save to database
    await this.reminderRepository.create(reminder);

    // Enqueue job
    await this.queuePort.enqueueReminder({
      reminderId: reminder.id,
      scheduledAt: reminder.scheduledAt.toString(),
    });

    // Return DTO
    return ok(this.toDTO(reminder));
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
