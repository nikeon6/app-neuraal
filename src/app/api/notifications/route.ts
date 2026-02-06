import { NextRequest, NextResponse } from "next/server";
import { ListNotifications } from "@/application/use-cases/ListNotifications";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * GET /api/notifications
 * Returns notifications for the authenticated user.
 *
 * Query params:
 * - since: string (optional, ISO datetime to filter from)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Get query params
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  // Execute use case
  const repository = new PrismaNotificationRepository();
  const listNotifications = new ListNotifications(repository);

  const result = await listNotifications.execute({ userId, since });

  if (result.isErr()) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ notifications: result.value }, { status: 200 });
}
