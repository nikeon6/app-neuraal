/**
 * Port for RefreshToken persistence.
 */
export interface RefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  replacedById: string | null;
}

export interface RefreshTokenRepository {
  create(
    data: Omit<
      RefreshTokenData,
      "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById"
    >,
  ): Promise<RefreshTokenData>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenData | null>;
  revokeByTokenHash(tokenHash: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
  rotateToken(
    oldTokenHash: string,
    newTokenData: Omit<
      RefreshTokenData,
      "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById"
    >,
    now: Date,
  ): Promise<RefreshTokenData>;
}
