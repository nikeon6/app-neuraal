import { NextRequest, NextResponse } from "next/server";
import { CompleteAttachmentUpload } from "@/application/use-cases/attachments/CompleteAttachmentUpload";
import { PrismaAttachmentRepository } from "@/infrastructure/persistence/PrismaAttachmentRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * POST /api/attachments/complete
 * Marks an attachment as ready after successful upload.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Parse request body
  let body: { attachmentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { attachmentId } = body;

  if (!attachmentId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "attachmentId is required" } },
      { status: 400 }
    );
  }

  // Execute use case
  const attachmentRepository = new PrismaAttachmentRepository();
  const completeUpload = new CompleteAttachmentUpload(attachmentRepository);

  const result = await completeUpload.execute({ userId, attachmentId });

  if (result.isErr()) {
    const { code, message } = result.error;
    const statusCode = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ attachment: result.value }, { status: 200 });
}
