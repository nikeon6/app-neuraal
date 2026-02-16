import { Sticky } from "@/domain/entities/Sticky";
import type { StickyRepository } from "@/application/ports/StickyRepository";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Prisma implementation of StickyRepository.
 * Handles persistence of Sticky entities to PostgreSQL.
 */
export class PrismaStickyRepository implements StickyRepository {
  async findById(stickyId: string): Promise<Sticky | null> {
    const record = await prisma.sticky.findUnique({
      where: { id: stickyId },
    });

    if (!record) return null;

    const result = Sticky.create({
      id: record.id,
      userId: record.userId,
      title: record.title,
      content: record.content as Record<string, unknown>,
      version: record.version,
      sortOrder: record.sortOrder,
      columnIndex: record.columnIndex,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async findByUser(userId: string): Promise<Sticky[]> {
    const records = await prisma.sticky.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return records
      .map((record) => {
        const result = Sticky.create({
          id: record.id,
          userId: record.userId,
          title: record.title,
          content: record.content as Record<string, unknown>,
          version: record.version,
          sortOrder: record.sortOrder,
          columnIndex: record.columnIndex,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
        return result.isOk() ? result.value : null;
      })
      .filter((s): s is Sticky => s !== null);
  }

  async save(sticky: Sticky): Promise<void> {
    await prisma.sticky.create({
      data: {
        id: sticky.id,
        userId: sticky.userId,
        title: sticky.title.toString(),
        content: sticky.content.toJSON() as Prisma.InputJsonValue,
        version: sticky.version,
        sortOrder: sticky.sortOrder,
        columnIndex: sticky.columnIndex,
        createdAt: sticky.createdAt,
      },
    });
  }

  async update(sticky: Sticky): Promise<void> {
    await prisma.sticky.update({
      where: { id: sticky.id },
      data: {
        title: sticky.title.toString(),
        content: sticky.content.toJSON() as Prisma.InputJsonValue,
        version: sticky.version,
        columnIndex: sticky.columnIndex,
      },
    });
  }

  async delete(stickyId: string): Promise<void> {
    await prisma.sticky.delete({
      where: { id: stickyId },
    });
  }

  async reorder(
    userId: string,
    items: { id: string; sortOrder: number; columnIndex: number }[],
  ): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.sticky.updateMany({
          where: { id: item.id, userId },
          data: { sortOrder: item.sortOrder, columnIndex: item.columnIndex },
        }),
      ),
    );
  }
}
