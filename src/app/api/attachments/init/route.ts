import { NextRequest, NextResponse } from "next/server";
import { InitAttachmentUpload } from "@/application/use-cases/attachments/InitAttachmentUpload";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { S3ObjectStorage } from "@/infrastructure/storage/S3ObjectStorage";
import { getAttachmentConfig } from "@/infrastructure/config/AttachmentConfig";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * POST /api/attachments/init
 * Initializes an attachment upload and returns a presigned URL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Parse request body
  let body: {
    entryId?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    kind?: "inline" | "file";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { entryId, filename, mimeType, sizeBytes, kind } = body;

  // Validate required fields
  if (!entryId || !filename || !mimeType || !sizeBytes || !kind) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "entryId, filename, mimeType, sizeBytes, and kind are required",
        },
      },
      { status: 400 },
    );
  }

  // Get config
  const config = getAttachmentConfig();

  // Execute use case
  const entryRepository = new PrismaEntryRepository();
  const attachmentRepository = new PrismaAttachmentRepository();
  const objectStorage = new S3ObjectStorage();
  const initUpload = new InitAttachmentUpload(
    entryRepository,
    attachmentRepository,
    objectStorage,
    config,
  );

  const result = await initUpload.execute({
    userId,
    entryId,
    filename,
    mimeType,
    sizeBytes,
    kind,
  });

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    let statusCode: number;
    switch (code) {
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "QUOTA_EXCEEDED":
        statusCode = 413;
        break;
      default:
        statusCode = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode },
    );
  }

  return NextResponse.json(result.value, { status: 201 });
}
