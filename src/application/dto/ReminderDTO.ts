/**
 * DTO for creating a reminder.
 * Used as input for the CreateReminder use case.
 */
export interface CreateReminderDTO {
  entryId: string;
  scheduledAt: string;
  channel: string;
  message?: string | null;
}

/**
 * DTO for updating a reminder.
 * Used as input for the UpdateReminder use case.
 */
export interface UpdateReminderDTO {
  scheduledAt?: string;
  channel?: string;
  message?: string | null;
  status?: "canceled";
}

/**
 * DTO for reminder response.
 * Used as output from use cases.
 */
export interface ReminderDTO {
  id: string;
  userId: string;
  entryId: string;
  scheduledAt: string;
  channel: string;
  message: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
