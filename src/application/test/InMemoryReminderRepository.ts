import { Reminder } from "../../domain/entities/Reminder";
import { ReminderRepository } from "../ports/ReminderRepository";

/**
 * In-memory implementation of ReminderRepository for testing.
 */
export class InMemoryReminderRepository implements ReminderRepository {
  private reminders: Map<string, Reminder> = new Map();

  async create(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async findById(id: string): Promise<Reminder | null> {
    return this.reminders.get(id) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Reminder | null> {
    const reminder = this.reminders.get(id);
    if (!reminder || reminder.userId !== userId) {
      return null;
    }
    return reminder;
  }

  async update(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async listByUser(userId: string): Promise<Reminder[]> {
    return Array.from(this.reminders.values()).filter(
      (reminder) => reminder.userId === userId,
    );
  }

  async listPendingByEntry(
    userId: string,
    entryId: string,
  ): Promise<Reminder[]> {
    return Array.from(this.reminders.values()).filter(
      (reminder) =>
        reminder.userId === userId &&
        reminder.entryId === entryId &&
        reminder.status.isPending(),
    );
  }

  async countPendingWhatsappByUserId(userId: string): Promise<number> {
    return Array.from(this.reminders.values()).filter(
      (reminder) =>
        reminder.userId === userId &&
        reminder.status.isPending() &&
        reminder.channel.toString() === "whatsapp",
    ).length;
  }

  // Test helpers
  clear(): void {
    this.reminders.clear();
  }

  getAll(): Reminder[] {
    return Array.from(this.reminders.values());
  }
}
