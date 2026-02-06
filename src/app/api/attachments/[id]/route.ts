import { NextRequest, NextResponse } from "next/server";
import { DeleteAttachment } from "@/application/use-cases/DeleteAttachment";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { S3ObjectStorage } from "@/infrastructure/storage/S3ObjectStorage";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/attachments/:id
 * Deletes an attachment.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: attachmentId } = await context.params;

  // Validate attachmentId
  if (!attachmentId || attachmentId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "attachmentId is required" } },
      { status: 400 }
    );
  }

  // Execute use case
  const attachmentRepository = new PrismaAttachmentRepository();
  const objectStorage = new S3ObjectStorage();
  const deleteAttachment = new DeleteAttachment(attachmentRepository, objectStorage);

  const result = await deleteAttachment.execute({ userId, attachmentId });

  if (result.isErr()) {
    const { code, message } = result.error;
    const statusCode = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return new NextResponse(null, { status: 204 });
}
