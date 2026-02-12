import type { PasswordResetTokenData, PasswordResetTokenRepository } from "../ports/PasswordResetTokenRepository";

export class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  private tokens: PasswordResetTokenData[] = [];
  private idCounter = 0;

  async create(data: Omit<PasswordResetTokenData, "id" | "createdAt" | "usedAt">): Promise<PasswordResetTokenData> {
    const token: PasswordResetTokenData = {
      id: `prt-${++this.idCounter}`,
      ...data,
      createdAt: new Date(),
      usedAt: null,
    };
    this.tokens.push(token);
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenData | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async markUsed(tokenHash: string, now: Date): Promise<void> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (token) {
      token.usedAt = now;
    }
  }

  // Test helper
  getAll(): PasswordResetTokenData[] {
    return [...this.tokens];
  }
}
