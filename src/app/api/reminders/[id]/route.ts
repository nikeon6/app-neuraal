import { NextRequest, NextResponse } from "next/server";
import { UpdateReminder } from "@/application/use-cases/reminders/UpdateReminder";
import { PrismaReminderRepository } from "@/infrastructure/persistence/PrismaReminderRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/reminders/:id
 * Updates a reminder (reschedule, change channel, cancel).
 *
 * Request body (all optional):
 * - scheduledAt: string (ISO datetime)
 * - channel: string
 * - message: string | null
 * - status: "canceled"
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  // Check authentication
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { id: reminderId } = await params;

  // Parse request body
  let body: {
    scheduledAt?: string;
    channel?: string;
    message?: string | null;
    status?: "canceled";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  // Execute use case
  const reminderRepository = new PrismaReminderRepository();
  const queuePort = new BullMQAdapter();

  const updateReminder = new UpdateReminder(reminderRepository, queuePort);

  const result = await updateReminder.execute({
    userId,
    reminderId,
    scheduledAt: body.scheduledAt,
    channel: body.channel,
    message: body.message,
    status: body.status,
  });

  // Close queue connection
  await queuePort.close();

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    let statusCode = 400;
    if (code === "NOT_FOUND") statusCode = 404;
    else if (code === "CONFLICT") statusCode = 409;

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode },
    );
  }

  return NextResponse.json({ reminder: result.value }, { status: 200 });
}
