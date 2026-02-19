import { User } from "@/domain/entities/User";
import type { UserRepository } from "../ports/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  private readonly users: Map<string, User> = new Map();

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toString() === normalized) {
        return user;
      }
    }
    return null;
  }

  async findById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async create(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async updatePasswordHash(
    userId: string,
    newPasswordHash: string,
  ): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) return;

    const rebuilt = User.create({
      id: existing.id,
      email: existing.email.toString(),
      passwordHash: newPasswordHash,
      phoneNumber: existing.phoneNumber,
      emailVerified: existing.emailVerified,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    if (rebuilt.isOk()) {
      this.users.set(userId, rebuilt.value);
    }
  }

  async markEmailVerified(userId: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) return;

    const rebuilt = User.create({
      id: existing.id,
      email: existing.email.toString(),
      passwordHash: existing.passwordHash.toString(),
      phoneNumber: existing.phoneNumber,
      emailVerified: true,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    if (rebuilt.isOk()) {
      this.users.set(userId, rebuilt.value);
    }
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}
