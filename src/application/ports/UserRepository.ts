import type { User } from "@/domain/entities/User";

/**
 * Port for User persistence.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  create(user: User): Promise<void>;
  updatePasswordHash(userId: string, newPasswordHash: string): Promise<void>;
}
