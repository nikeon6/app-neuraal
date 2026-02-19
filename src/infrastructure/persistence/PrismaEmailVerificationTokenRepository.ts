import type {
  EmailVerificationTokenData,
  EmailVerificationTokenRepository,
} from "@/application/ports/EmailVerificationTokenRepository";
import { prisma } from "./prisma";

function toData(record: {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}): EmailVerificationTokenData {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
  };
}

export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  async create(
    data: Omit<EmailVerificationTokenData, "id" | "createdAt" | "usedAt">,
  ): Promise<EmailVerificationTokenData> {
    const record = await prisma.emailVerificationToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    return toData(record);
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenData | null> {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    return record ? toData(record) : null;
  }

  async markUsed(tokenHash: string, now: Date): Promise<void> {
    await prisma.emailVerificationToken.updateMany({
      where: { tokenHash },
      data: { usedAt: now },
    });
  }
}
