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
    >,
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
    now: Date,
  ): Promise<RefreshTokenData> {
    // Atomic rotation: revoke old token (only if not already revoked) and create
    // new token in a single transaction. The conditional updateMany ensures that
    // concurrent requests with the same old token cannot both succeed — only the
    // first one will match the WHERE clause; subsequent ones get count 0 and fail.
    return await prisma.$transaction(async (tx) => {
      // 1. Conditionally revoke old token (only if revokedAt IS NULL)
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          tokenHash: oldTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          rotatedAt: now,
        },
      });

      // If no rows were updated, the old token was already revoked/rotated
      // (concurrent request won the race). Abort — caller should treat as reuse.
      if (revokeResult.count === 0) {
        throw new Error("REFRESH_TOKEN_ALREADY_CONSUMED");
      }

      // 2. Create new token
      const newRecord = await tx.refreshToken.create({
        data: {
          userId: newTokenData.userId,
          tokenHash: newTokenData.tokenHash,
          expiresAt: newTokenData.expiresAt,
        },
      });

      // 3. Link old → new (for audit trail)
      await tx.refreshToken.updateMany({
        where: { tokenHash: oldTokenHash },
        data: { replacedById: newRecord.id },
      });

      return toData(newRecord);
    });
  }
}
