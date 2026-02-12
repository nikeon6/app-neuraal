import type { User } from "@/domain/entities/User";
import type { UserRepository } from "../ports/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

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

  // Test helper
  getAll(): User[] {
    return Array.from(this.users.values());
  }
}
