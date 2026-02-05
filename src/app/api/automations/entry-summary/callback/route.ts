import { NextRequest, NextResponse } from "next/server";
import {
  HandleEntrySummaryCallback,
  EntrySummaryCallbackPayload,
} from "@/application/use-cases/HandleEntrySummaryCallback";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaSummaryRequestRepository } from "@/infrastructure/persistence/PrismaSummaryRequestRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";

/**
 * POST /api/automations/entry-summary/callback
 * Callback endpoint for n8n to deliver summary results.
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
  let payload: EntrySummaryCallbackPayload;
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  // Validate required fields
  if (
    !payload.requestId ||
    !payload.userId ||
    !payload.entryId ||
    !payload.summary ||
    !payload.format
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: requestId, userId, entryId, summary, format",
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
      { error: { code: "INTERNAL_ERROR", message: "Server configuration error" } },
      { status: 500 }
    );
  }

  // Create dependencies
  const entryRepository = new PrismaEntryRepository();
  const summaryRequestRepository = new PrismaSummaryRequestRepository();
  const notificationRepository = new PrismaNotificationRepository();

  // Execute use case
  const handleCallback = new HandleEntrySummaryCallback(
    entryRepository,
    summaryRequestRepository,
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

    // Map error codes to HTTP status codes
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

    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  // Return success
  return NextResponse.json(
    {
      success: true,
      alreadyProcessed: result.value.alreadyProcessed ?? false,
    },
    { status: 200 }
  );
}
