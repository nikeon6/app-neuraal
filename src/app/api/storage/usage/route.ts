import { NextRequest, NextResponse } from "next/server";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { getAttachmentConfig } from "@/infrastructure/config/AttachmentConfig";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * GET /api/storage/usage
 * Returns the authenticated user's current storage usage and limits.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const config = getAttachmentConfig();
  const attachmentRepository = new PrismaAttachmentRepository();

  const usedBytes = await attachmentRepository.sumActiveBytesByUser(userId);

  return NextResponse.json({
    usedBytes,
    maxUserStorageBytes: config.maxUserStorageQuotaBytes.toNumber(),
    maxEntryAttachmentBytes: config.maxEntryAttachmentSizeBytes.toNumber(),
  });
}
