import { NextRequest, NextResponse } from "next/server";
import { HandleEntryTranscriptCallback } from "@/application/use-cases/transcripts/HandleEntryTranscriptCallback";
import { RecordAiUsageFromCallback } from "@/application/use-cases/ai/RecordAiUsageFromCallback";
import { PrismaTranscriptRequestRepository } from "@/infrastructure/persistence/PrismaTranscriptRequestRepository";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { createHmac } from "node:crypto";

/**
 * POST /api/automations/entry-transcript/callback
 * n8n calls this after completing a YouTube transcription.
 * Secured with HMAC signature verification.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify HMAC signature
  const signature = request.headers.get("x-signature");
  const timestamp = request.headers.get("x-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await request.text();
  const secret = process.env.N8N_WEBHOOK_SECRET ?? "";
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    requestId: string;
    userId: string;
    entryId: string;
    transcriptText: string;
    format?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      model?: string;
    };
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const recordAiUsage = new RecordAiUsageFromCallback(
    new PrismaAiUsageRepository(),
    new SystemClock()
  );

  const handleCallback = new HandleEntryTranscriptCallback(
    new PrismaTranscriptRequestRepository(),
    new PrismaEntryRepository(),
    new PrismaNotificationRepository(),
    undefined,
    recordAiUsage
  );

  const result = await handleCallback.execute(payload);

  if (result.isErr()) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.code === "NOT_FOUND" ? 404 : 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
