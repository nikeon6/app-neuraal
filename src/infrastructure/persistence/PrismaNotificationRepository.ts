import { prisma } from "./prisma";
import { Notification } from "../../domain/entities/Notification";
import { NotificationRepository } from "../../application/ports/NotificationRepository";
import { Prisma } from "@/generated/prisma/client";

/**
 * Prisma implementation of NotificationRepository.
 */
export class PrismaNotificationRepository implements NotificationRepository {
  async create(notification: Notification): Promise<void> {
    const json = notification.toJSON();
    await prisma.notification.create({
      data: {
        id: json.id,
        userId: json.userId,
        type: json.type,
        title: json.title,
        message: json.message,
        status: json.status,
        payload: json.payload as Prisma.InputJsonValue ?? Prisma.DbNull,
        createdAt: json.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Notification | null> {
    const record = await prisma.notification.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findByIdForUser(id: string, userId: string): Promise<Notification | null> {
    const record = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async update(notification: Notification): Promise<void> {
    const json = notification.toJSON();
    await prisma.notification.update({
      where: { id: json.id },
      data: {
        status: json.status,
      },
    });
  }

  async listByUserSince(userId: string, since: Date | null): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { userId };
    
    if (since) {
      where.createdAt = { gte: since };
    }

    const records = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const notifications: Notification[] = [];
    for (const record of records) {
      const notification = this.toDomain(record);
      if (notification) notifications.push(notification);
    }
    return notifications;
  }

  private toDomain(record: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    status: string;
    payload: Prisma.JsonValue;
    createdAt: Date;
  }): Notification | null {
    const result = Notification.create({
      id: record.id,
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      status: record.status,
      payload: record.payload as Record<string, unknown> | null,
      createdAt: record.createdAt,
    });

    return result.isOk() ? result.value : null;
  }
}
