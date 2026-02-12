import type {
  RefreshTokenData,
  RefreshTokenRepository,
} from "@/application/ports/RefreshTokenRepository";
import { prisma } from "./prisma";

function toData(record: {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  replacedById: string | null;
}): RefreshTokenData {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    rotatedAt: record.rotatedAt,
    replacedById: record.replacedById,
  };
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(
    data: Omit<
      RefreshTokenData,
      "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById"
    >
  ): Promise<RefreshTokenData> {
    const record = await prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    return toData(record);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenData | null> {
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return record ? toData(record) : null;
  }

  async revokeByTokenHash(tokenHash: string, now: Date): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: now },
    });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async rotateToken(
    oldTokenHash: string,
    newTokenData: Omit<
      RefreshTokenData,
      "id" | "createdAt" | "revokedAt" | "rotatedAt" | "replacedById"
    >,
    now: Date
  ): Promise<RefreshTokenData> {
    // Create new token
    const newRecord = await prisma.refreshToken.create({
      data: {
        userId: newTokenData.userId,
        tokenHash: newTokenData.tokenHash,
        expiresAt: newTokenData.expiresAt,
      },
    });

    // Revoke old token
    await prisma.refreshToken.updateMany({
      where: { tokenHash: oldTokenHash },
      data: {
        revokedAt: now,
        rotatedAt: now,
        replacedById: newRecord.id,
      },
    });

    return toData(newRecord);
  }
}
