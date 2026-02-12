import { User } from "@/domain/entities/User";
import type { UserRepository } from "@/application/ports/UserRepository";
import { prisma } from "./prisma";

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!record) return null;

    const result = User.create({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async findById(userId: string): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!record) return null;

    const result = User.create({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    return result.isOk() ? result.value : null;
  }

  async create(user: User): Promise<void> {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email.toString(),
        passwordHash: user.passwordHash.toString(),
      },
    });
  }
}
