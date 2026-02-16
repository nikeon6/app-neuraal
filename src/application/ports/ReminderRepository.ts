import { Reminder } from "../../domain/entities/Reminder";

/**
 * Port for Reminder persistence.
 */
export interface ReminderRepository {
  /**
   * Creates a new reminder.
   */
  create(reminder: Reminder): Promise<void>;

  /**
   * Finds a reminder by ID.
   */
  findById(id: string): Promise<Reminder | null>;

  /**
   * Finds a reminder by ID and userId (ownership check).
   * Returns null if not found OR not owned by user.
   */
  findByIdForUser(id: string, userId: string): Promise<Reminder | null>;

  /**
   * Updates an existing reminder.
   */
  update(reminder: Reminder): Promise<void>;

  /**
   * Lists reminders for a user.
   */
  listByUser(userId: string): Promise<Reminder[]>;

  /**
   * Lists pending reminders for a user and entry.
   */
  listPendingByEntry(userId: string, entryId: string): Promise<Reminder[]>;

  /**
   * Counts pending reminders with channel 'whatsapp' for a user.
   * Used for concurrency/quota limit on WhatsApp reminders.
   */
  countPendingWhatsappByUserId(userId: string): Promise<number>;
}
