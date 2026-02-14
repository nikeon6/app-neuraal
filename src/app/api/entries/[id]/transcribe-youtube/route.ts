import { NextRequest, NextResponse } from "next/server";
import { RequestEntryTranscript } from "@/application/use-cases/transcripts/RequestEntryTranscript";
import { GuardAiAction } from "@/application/use-cases/ai/GuardAiAction";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { PrismaTranscriptRequestRepository } from "@/infrastructure/persistence/PrismaTranscriptRequestRepository";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";
import { getRedisConnection } from "@/infrastructure/redis/RedisClient";
import { RedisRateLimiter } from "@/infrastructure/redis/RedisRateLimiter";
import { SystemClock } from "@/infrastructure/auth/SystemClock";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/transcribe-youtube
 * Requests a YouTube transcript for an entry.
 * Body: { url: string }
 * Returns 202 Accepted or error (400/403/409/429).
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const authResult = await getAuthUserId(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { userId } = authResult;
    const { id: entryId } = await context.params;

    // Parse body
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const { url } = body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "url is required" } },
        { status: 400 },
      );
    }

    // Guard AI action
    const config = getAiGuardrailsConfig();
    const actionConfig = config.transcriptYoutube;
    const transcriptRequestRepo = new PrismaTranscriptRequestRepository();

    const guardAiAction = new GuardAiAction(
      transcriptRequestRepo,
      new PrismaAiUsageRepository(),
      new RedisRateLimiter(getRedisConnection()),
      new SystemClock(),
      {
        maxActivePerUser: actionConfig.maxActivePerUser,
        maxActivePerEntry: actionConfig.maxActivePerEntry,
        maxInputChars: actionConfig.maxInputChars,
        maxInputBytes: 0,
        rateLimitPerMinute: actionConfig.rateLimitPerMinute,
        rateLimitPerHour: 0,
        monthlyQuotaRequests: actionConfig.monthlyQuotaRequests,
        rateLimitPrefix: config.rateLimitPrefix,
      },
    );

    const guardResult = await guardAiAction.execute({
      userId,
      action: "TRANSCRIPT_YOUTUBE",
      entryId,
      inputChars: url.trim().length,
    });

    if (guardResult.isErr()) {
      const { code, message, details } = guardResult.error;
      let statusCode: number;
      switch (code) {
        case "RATE_LIMITED":
          statusCode = 429;
          break;
        case "QUOTA_EXCEEDED":
          statusCode = 403;
          break;
        case "CONCURRENCY_LIMIT":
          statusCode = 409;
          break;
        default:
          statusCode = 400;
      }
      return NextResponse.json(
        { error: { code, message, ...(details !== undefined && { details }) } },
        { status: statusCode },
      );
    }

    // Execute use case
    const queuePort = new BullMQAdapter();
    const requestTranscript = new RequestEntryTranscript(
      new PrismaEntryRepository(),
      new PrismaNotificationRepository(),
      transcriptRequestRepo,
      queuePort,
      new PrismaAiUsageRepository(),
      new SystemClock(),
    );

    const result = await requestTranscript.execute({
      userId,
      entryId,
      youtubeUrl: url.trim(),
    });

    await queuePort.close();

    if (result.isErr()) {
      const { code, message } = result.error;
      const statusCode = code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { error: { code, message } },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        requestId: result.value.requestId,
        notificationId: result.value.notificationId,
        message:
          "Transcript generation started. Check notifications for progress.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/entries/:id/transcribe-youtube]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "production"
              ? "Transcript request failed."
              : message,
        },
      },
      { status: 500 },
    );
  }
}
