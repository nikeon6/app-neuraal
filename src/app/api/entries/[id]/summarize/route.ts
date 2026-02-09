import { NextRequest, NextResponse } from "next/server";
import { RequestEntrySummary } from "@/application/use-cases/summaries/RequestEntrySummary";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { PrismaSummaryRequestRepository } from "@/infrastructure/persistence/PrismaSummaryRequestRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/summarize
 * Requests an AI-generated summary for an entry.
 * Returns 202 Accepted with requestId and notificationId.
 */
export async function POST(
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

  // Validate entryId
  if (!entryId || entryId.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "entryId is required" } },
      { status: 400 }
    );
  }

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const notificationRepository = new PrismaNotificationRepository();
  const summaryRequestRepository = new PrismaSummaryRequestRepository();
  const queuePort = new BullMQAdapter();

  // Execute use case
  const requestEntrySummary = new RequestEntrySummary(
    entryRepository,
    notificationRepository,
    summaryRequestRepository,
    queuePort
  );

  const result = await requestEntrySummary.execute({ userId, entryId });

  // Close queue connection
  await queuePort.close();

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    let statusCode: number;
    switch (code) {
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "CONFLICT":
        statusCode = 409;
        break;
      default:
        statusCode = 400;
    }

    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  // 202 Accepted - async operation started
  return NextResponse.json(
    {
      requestId: result.value.requestId,
      notificationId: result.value.notificationId,
      message: "Summary generation started. Check notifications for progress.",
    },
    { status: 202 }
  );
}
