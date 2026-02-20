export interface EmailVerificationTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface EmailVerificationTokenRepository {
  create(
    data: Omit<EmailVerificationTokenData, "id" | "createdAt" | "usedAt">,
  ): Promise<EmailVerificationTokenData>;
  findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenData | null>;
  markUsed(tokenHash: string, now: Date): Promise<void>;
}
