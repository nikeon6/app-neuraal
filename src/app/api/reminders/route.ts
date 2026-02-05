import { NextRequest, NextResponse } from "next/server";
import { CreateReminder } from "@/application/use-cases/CreateReminder";
import { PrismaReminderRepository } from "@/infrastructure/persistence/PrismaReminderRepository";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

/**
 * POST /api/reminders
 * Creates a new reminder for an entry.
 *
 * Request body:
 * - entryId: string (required)
 * - scheduledAt: string (required, ISO datetime)
 * - channel: string (required, e.g., "whatsapp")
 * - message: string (optional)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check authentication
  const authResult = getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

  // Parse request body
  let body: {
    entryId?: string;
    scheduledAt?: string;
    channel?: string;
    message?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { entryId, scheduledAt, channel, message } = body;

  // Basic validation
  if (!entryId || !scheduledAt || !channel) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "entryId, scheduledAt, and channel are required",
        },
      },
      { status: 400 }
    );
  }

  // Execute use case
  const reminderRepository = new PrismaReminderRepository();
  const entryRepository = new PrismaEntryRepository();
  const queuePort = new BullMQAdapter();

  const createReminder = new CreateReminder(
    reminderRepository,
    entryRepository,
    queuePort
  );

  const result = await createReminder.execute({
    userId,
    entryId,
    scheduledAt,
    channel,
    message,
  });

  // Close queue connection
  await queuePort.close();

  if (result.isErr()) {
    const { code, message } = result.error;

    // Map error codes to HTTP status codes
    const statusCode =
      code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 400;

    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ reminder: result.value }, { status: 201 });
}
