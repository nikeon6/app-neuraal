import { NextRequest, NextResponse } from "next/server";
import { RequestEntrySummary } from "@/application/use-cases/summaries/RequestEntrySummary";
import { GuardAiAction } from "@/application/use-cases/ai/GuardAiAction";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaNotificationRepository } from "@/infrastructure/persistence/PrismaNotificationRepository";
import { PrismaSummaryRequestRepository } from "@/infrastructure/persistence/PrismaSummaryRequestRepository";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";
import { getRedisConnection } from "@/infrastructure/redis/RedisClient";
import { RedisRateLimiter } from "@/infrastructure/redis/RedisRateLimiter";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { CharCount } from "@/domain/value-objects/CharCount";
import { extractPlainText } from "@/shared/lib/extractPlainText";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/summarize
 * Requests an AI-generated summary for an entry.
 * Returns 202 Accepted, or 400/403/409/429 with error.code and optional details.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const authResult = await getAuthUserId(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { userId } = authResult;
    const { id: entryId } = await context.params;

    if (!entryId || entryId.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "entryId is required" } },
        { status: 400 }
      );
    }

    const entryRepository = new PrismaEntryRepository();
    const entry = await entryRepository.findById(entryId);
    if (!entry?.userId || entry.userId !== userId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Entry not found or access denied" } },
        { status: 404 }
      );
    }

    const plainText = extractPlainText(entry.content.toJSON());
    const title = entry.title.toString();
    const inputChars = title.length + plainText.length;

    const config = getAiGuardrailsConfig();
    const actionConfig = config.summary;
    const guardConfig = {
      maxActivePerUser: actionConfig.maxActivePerUser,
      maxActivePerEntry: actionConfig.maxActivePerEntry,
      maxInputChars: actionConfig.maxInputChars,
      maxInputBytes: 0,
      rateLimitPerMinute: actionConfig.rateLimitPerMinute,
      rateLimitPerHour: actionConfig.rateLimitPerHour,
      monthlyQuotaRequests: actionConfig.monthlyQuotaRequests,
      rateLimitPrefix: config.rateLimitPrefix,
    };

    const guardAiAction = new GuardAiAction(
      new PrismaSummaryRequestRepository(),
      new PrismaAiUsageRepository(),
      new RedisRateLimiter(getRedisConnection()),
      new SystemClock(),
      guardConfig
    );

    const guardResult = await guardAiAction.execute({
      userId,
      action: "SUMMARY",
      entryId,
      inputChars,
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
        case "INPUT_TOO_LARGE":
          statusCode = 400;
          break;
        default:
          statusCode = 400;
      }
      return NextResponse.json(
        { error: { code, message, ...(details !== undefined && { details }) } },
        { status: statusCode }
      );
    }

    const guardOutput = guardResult.value;
    let plainTextForSummary: string | undefined;
    if (guardOutput.truncated && guardOutput.maxChars !== undefined) {
      const combined = `${title} ${plainText}`.trim();
      plainTextForSummary = CharCount.truncate(combined, guardOutput.maxChars);
    }

    const notificationRepository = new PrismaNotificationRepository();
    const summaryRequestRepository = new PrismaSummaryRequestRepository();
    const aiUsageRepository = new PrismaAiUsageRepository();
    const queuePort = new BullMQAdapter();

    const requestEntrySummary = new RequestEntrySummary(
      entryRepository,
      notificationRepository,
      summaryRequestRepository,
      queuePort,
      aiUsageRepository,
      new SystemClock()
    );

    const result = await requestEntrySummary.execute({
      userId,
      entryId,
      plainTextForSummary,
    });

    await queuePort.close();

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
      return NextResponse.json({ error: { code, message } }, { status: statusCode });
    }

    return NextResponse.json(
      {
        requestId: result.value.requestId,
        notificationId: result.value.notificationId,
        message: "Summary generation started. Check notifications for progress.",
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isDev = process.env.NODE_ENV !== "production";
    console.error("[POST /api/entries/:id/summarize]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: isDev ? message : "Summary request failed. Try again later.",
        },
      },
      { status: 500 }
    );
  }
}
