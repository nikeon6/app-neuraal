import type { RefreshTokenData, RefreshTokenRepository } from "../ports/RefreshTokenRepository";

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private tokens: RefreshTokenData[] = [];
  private idCounter = 0;

  async create(data: Omit<RefreshTokenData, "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById">): Promise<RefreshTokenData> {
    const token: RefreshTokenData = {
      id: `rt-${++this.idCounter}`,
      ...data,
      createdAt: new Date(),
      revokedAt: null,
      rotatedAt: null,
      replacedById: null,
    };
    this.tokens.push(token);
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenData | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async revokeByTokenHash(tokenHash: string, now: Date): Promise<void> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (token) {
      token.revokedAt = now;
    }
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const token of this.tokens) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = now;
      }
    }
  }

  async rotateToken(
    oldTokenHash: string,
    newTokenData: Omit<RefreshTokenData, "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById">,
    now: Date
  ): Promise<RefreshTokenData> {
    const oldToken = this.tokens.find((t) => t.tokenHash === oldTokenHash);
    const newToken = await this.create(newTokenData);
    if (oldToken) {
      oldToken.revokedAt = now;
      oldToken.rotatedAt = now;
      oldToken.replacedById = newToken.id;
    }
    return newToken;
  }

  // Test helper
  getAll(): RefreshTokenData[] {
    return [...this.tokens];
  }
}
