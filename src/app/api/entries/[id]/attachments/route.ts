import { NextRequest, NextResponse } from "next/server";
import { ListAttachmentsByEntry } from "@/application/use-cases/attachments/ListAttachmentsByEntry";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { getAttachmentConfig } from "@/infrastructure/config/AttachmentConfig";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/entries/{id}/attachments
 * Lists all non-deleted attachments for an entry, plus usage/quota info.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: entryId } = await context.params;

  // Read quota config for limits
  const config = getAttachmentConfig();

  // Execute use case
  const entryRepository = new PrismaEntryRepository();
  const attachmentRepository = new PrismaAttachmentRepository();
  const listAttachments = new ListAttachmentsByEntry(
    entryRepository,
    attachmentRepository,
    {
      entryLimitBytes: config.maxEntryAttachmentSizeBytes.toNumber(),
      userLimitBytes: config.maxUserStorageQuotaBytes.toNumber(),
    }
  );

  const result = await listAttachments.execute({ userId, entryId });

  if (result.isErr()) {
    const { code, message } = result.error;
    const status = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status });
  }

  return NextResponse.json(result.value, { status: 200 });
}
