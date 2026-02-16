import type {
  PasswordResetTokenData,
  PasswordResetTokenRepository,
} from "@/application/ports/PasswordResetTokenRepository";
import { prisma } from "./prisma";

function toData(record: {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}): PasswordResetTokenData {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
  };
}

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  async create(
    data: Omit<PasswordResetTokenData, "id" | "createdAt" | "usedAt">,
  ): Promise<PasswordResetTokenData> {
    const record = await prisma.passwordResetToken.create({
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
  ): Promise<PasswordResetTokenData | null> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    return record ? toData(record) : null;
  }

  async markUsed(tokenHash: string, now: Date): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash },
      data: { usedAt: now },
    });
  }
}
