import { NextRequest, NextResponse } from "next/server";
import { MarkNotificationRead } from "@/application/use-cases/MarkNotificationRead";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/notifications/:id/read
 * Marks a notification as read.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: notificationId } = await params;

  // Execute use case
  const repository = new PrismaNotificationRepository();
  const markNotificationRead = new MarkNotificationRead(repository);

  const result = await markNotificationRead.execute({ userId, notificationId });

  if (result.isErr()) {
    const { code, message } = result.error;
    const statusCode = code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
