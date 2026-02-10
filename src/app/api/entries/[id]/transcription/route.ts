import { NextRequest, NextResponse } from "next/server";
import { RequestTranscription } from "@/application/use-cases/transcriptions/RequestTranscription";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { PrismaTranscriptionRequestRepository } from "@/infrastructure/persistence/PrismaTranscriptionRequestRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/transcription
 * Requests a YouTube video transcription for an entry.
 * Returns 202 Accepted with requestId and notificationId.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let queuePort: BullMQAdapter | null = null;

  try {
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
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "entryId is required",
          },
        },
        { status: 400 }
      );
    }

    // Parse body
    let body: { youtubeUrl?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid JSON body",
          },
        },
        { status: 400 }
      );
    }

    if (!body.youtubeUrl || body.youtubeUrl.trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "youtubeUrl is required",
          },
        },
        { status: 400 }
      );
    }

    // Create dependencies
    const entryRepository = new PrismaEntryRepository();
    const notificationRepository = new PrismaNotificationRepository();
    const transcriptionRequestRepository =
      new PrismaTranscriptionRequestRepository();
    queuePort = new BullMQAdapter();

    // Execute use case
    const requestTranscription = new RequestTranscription(
      entryRepository,
      notificationRepository,
      transcriptionRequestRepository,
      queuePort
    );

    const result = await requestTranscription.execute({
      userId,
      entryId,
      youtubeUrl: body.youtubeUrl,
    });

    // Close queue connection
    await queuePort.close();
    queuePort = null;

    if (result.isErr()) {
      const { code, message } = result.error;

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

      return NextResponse.json(
        { error: { code, message } },
        { status: statusCode }
      );
    }

    // 202 Accepted — async operation started
    return NextResponse.json(
      {
        requestId: result.value.requestId,
        notificationId: result.value.notificationId,
        message:
          "Transcription started. Check notifications for progress.",
      },
      { status: 202 }
    );
  } catch (error) {
    // Clean up queue connection on error
    if (queuePort) {
      try {
        await queuePort.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    console.error("[POST /api/entries/:id/transcription] Unhandled error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
