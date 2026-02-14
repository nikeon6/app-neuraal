import { prisma } from "./prisma";
import { Reminder } from "../../domain/entities/Reminder";
import { ReminderRepository } from "../../application/ports/ReminderRepository";

/**
 * Prisma implementation of ReminderRepository.
 */
export class PrismaReminderRepository implements ReminderRepository {
  async create(reminder: Reminder): Promise<void> {
    const json = reminder.toJSON();
    await prisma.reminder.create({
      data: {
        id: json.id,
        userId: json.userId,
        entryId: json.entryId,
        scheduledAt: new Date(json.scheduledAt),
        channel: json.channel,
        message: json.message,
        status: json.status,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Reminder | null> {
    const record = await prisma.reminder.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findByIdForUser(id: string, userId: string): Promise<Reminder | null> {
    const record = await prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async update(reminder: Reminder): Promise<void> {
    const json = reminder.toJSON();
    await prisma.reminder.update({
      where: { id: json.id },
      data: {
        scheduledAt: new Date(json.scheduledAt),
        channel: json.channel,
        message: json.message,
        status: json.status,
        updatedAt: json.updatedAt,
      },
    });
  }

  async listByUser(userId: string): Promise<Reminder[]> {
    const records = await prisma.reminder.findMany({
      where: { userId },
      orderBy: { scheduledAt: "asc" },
    });

    const reminders: Reminder[] = [];
    for (const record of records) {
      const reminder = this.toDomain(record);
      if (reminder) reminders.push(reminder);
    }
    return reminders;
  }

  async listPendingByEntry(
    userId: string,
    entryId: string,
  ): Promise<Reminder[]> {
    const records = await prisma.reminder.findMany({
      where: { userId, entryId, status: "pending" },
      orderBy: { scheduledAt: "asc" },
    });

    const reminders: Reminder[] = [];
    for (const record of records) {
      const reminder = this.toDomain(record);
      if (reminder) reminders.push(reminder);
    }
    return reminders;
  }

  private toDomain(record: {
    id: string;
    userId: string;
    entryId: string;
    scheduledAt: Date;
    channel: string;
    message: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Reminder | null {
    const result = Reminder.create({
      id: record.id,
      userId: record.userId,
      entryId: record.entryId,
      scheduledAt: record.scheduledAt,
      channel: record.channel,
      message: record.message,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async countPendingWhatsappByUserId(userId: string): Promise<number> {
    const count = await prisma.reminder.count({
      where: {
        userId,
        channel: "whatsapp",
        status: "pending",
      },
    });
    return count;
  }
}
