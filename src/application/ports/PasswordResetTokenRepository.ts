export interface PasswordResetTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PasswordResetTokenRepository {
  create(
    data: Omit<PasswordResetTokenData, "id" | "createdAt" | "usedAt">,
  ): Promise<PasswordResetTokenData>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenData | null>;
  markUsed(tokenHash: string, now: Date): Promise<void>;
}
