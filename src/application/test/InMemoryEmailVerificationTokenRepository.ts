import type {
  EmailVerificationTokenData,
  EmailVerificationTokenRepository,
} from "../ports/EmailVerificationTokenRepository";

export class InMemoryEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  private tokens: EmailVerificationTokenData[] = [];
  private idCounter = 0;

  async create(
    data: Omit<EmailVerificationTokenData, "id" | "createdAt" | "usedAt">,
  ): Promise<EmailVerificationTokenData> {
    const token: EmailVerificationTokenData = {
      id: `evt-${++this.idCounter}`,
      ...data,
      createdAt: new Date(),
      usedAt: null,
    };
    this.tokens.push(token);
    return token;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenData | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async markUsed(tokenHash: string, now: Date): Promise<void> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (token) {
      token.usedAt = now;
    }
  }

  getAll(): EmailVerificationTokenData[] {
    return [...this.tokens];
  }
}
