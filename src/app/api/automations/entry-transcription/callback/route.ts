import { NextRequest, NextResponse } from "next/server";
import {
  HandleTranscriptionCallback,
  TranscriptionCallbackPayload,
} from "@/application/use-cases/transcriptions/HandleTranscriptionCallback";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaTranscriptionRequestRepository } from "@/infrastructure/persistence/PrismaTranscriptionRequestRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";

/**
 * POST /api/automations/entry-transcription/callback
 * Callback endpoint for n8n to deliver transcription results.
 * Uses HMAC signature for authentication (NOT x-user-id).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Get signature headers
  const timestamp = request.headers.get("X-Timestamp");
  const signature = request.headers.get("X-Signature");

  if (!timestamp || !signature) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing X-Timestamp or X-Signature headers",
        },
      },
      { status: 401 }
    );
  }

  // Get raw body for signature verification
  let rawBody: string;
  let payload: TranscriptionCallbackPayload;
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
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

  // Validate required fields
  if (
    !payload.requestId ||
    !payload.userId ||
    !payload.entryId ||
    !payload.youtubeUrl ||
    !payload.transcription
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: requestId, userId, entryId, youtubeUrl, transcription",
        },
      },
      { status: 400 }
    );
  }

  // Get webhook secret from env
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    console.error("N8N_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Server configuration error",
        },
      },
      { status: 500 }
    );
  }

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const transcriptionRequestRepository =
    new PrismaTranscriptionRequestRepository();
  const notificationRepository = new PrismaNotificationRepository();

  // Execute use case
  const handleCallback = new HandleTranscriptionCallback(
    entryRepository,
    transcriptionRequestRepository,
    notificationRepository,
    webhookSecret
  );

  const result = await handleCallback.execute({
    rawBody,
    timestamp,
    signature,
    payload,
  });

  if (result.isErr()) {
    const { code, message } = result.error;

    let statusCode: number;
    switch (code) {
      case "UNAUTHORIZED":
        statusCode = 401;
        break;
      case "NOT_FOUND":
        statusCode = 404;
        break;
      case "VALIDATION_ERROR":
        statusCode = 400;
        break;
      default:
        statusCode = 500;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status: statusCode }
    );
  }

  return NextResponse.json(
    {
      success: true,
      alreadyProcessed: result.value.alreadyProcessed ?? false,
    },
    { status: 200 }
  );
}
