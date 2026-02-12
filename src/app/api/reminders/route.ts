import { NextRequest, NextResponse } from "next/server";
import { CreateReminder } from "@/application/use-cases/reminders/CreateReminder";
import { GuardAiAction } from "@/application/use-cases/ai/GuardAiAction";
import { ConsumeAiRequest } from "@/application/use-cases/ai/ConsumeAiRequest";
import { PrismaReminderRepository } from "@/infrastructure/persistence/PrismaReminderRepository";
import { PrismaEntryRepository } from "@/infrastructure/persistence/PrismaEntryRepository";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { BullMQAdapter } from "@/infrastructure/queue/BullMQAdapter";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";
import { getRedisConnection } from "@/infrastructure/redis/RedisClient";
import { RedisRateLimiter } from "@/infrastructure/redis/RedisRateLimiter";
import { SystemClock } from "@/infrastructure/auth/SystemClock";

/**
 * Runs AI guardrails for WhatsApp reminders (rate limit, quota, concurrency).
 * Returns a NextResponse with error if guard fails, or null if allowed.
 */
async function guardWhatsappReminder(
  userId: string,
  messageLength: number
): Promise<NextResponse | null> {
  const config = getAiGuardrailsConfig();
  const waConfig = config.reminderWhatsapp;
  const reminderRepo = new PrismaReminderRepository();

  const whatsappConcurrencyChecker = {
    countActiveByUserId: (uid: string) => reminderRepo.countPendingWhatsappByUserId(uid),
  };

  const guardAiAction = new GuardAiAction(
    whatsappConcurrencyChecker,
    new PrismaAiUsageRepository(),
    new RedisRateLimiter(getRedisConnection()),
    new SystemClock(),
    {
      maxActivePerUser: waConfig.maxActivePerUser,
      maxActivePerEntry: 0,
      maxInputChars: waConfig.maxInputChars,
      maxInputBytes: 0,
      rateLimitPerMinute: waConfig.rateLimitPerMinute,
      rateLimitPerHour: 0,
      monthlyQuotaRequests: waConfig.monthlyQuotaRequests,
      rateLimitPrefix: config.rateLimitPrefix,
    }
  );

  const guardResult = await guardAiAction.execute({
    userId,
    action: "REMINDER_WHATSAPP",
    inputChars: messageLength,
  });

  if (guardResult.isErr()) {
    const { code, message: msg, details } = guardResult.error;
    let statusCode: number;
    switch (code) {
      case "RATE_LIMITED": statusCode = 429; break;
      case "QUOTA_EXCEEDED": statusCode = 403; break;
      case "CONCURRENCY_LIMIT": statusCode = 409; break;
      default: statusCode = 400;
    }
    return NextResponse.json(
      { error: { code, message: msg, ...(details !== undefined && { details }) } },
      { status: statusCode }
    );
  }

  // Consume WhatsApp request quota
  const consumeAiRequest = new ConsumeAiRequest(new PrismaAiUsageRepository(), new SystemClock());
  await consumeAiRequest.execute({ userId, action: "REMINDER_WHATSAPP" });

  return null;
}

/**
 * POST /api/reminders
 * Creates a new reminder for an entry.
 * If channel is "whatsapp", AI guardrails are enforced (rate limit, quota, concurrency).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;

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

  if (!entryId || !scheduledAt || !channel) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "entryId, scheduledAt, and channel are required" } },
      { status: 400 }
    );
  }

  // WhatsApp guardrails
  if (channel === "whatsapp") {
    const guardError = await guardWhatsappReminder(userId, message?.length ?? 0);
    if (guardError) return guardError;
  }

  // Execute CreateReminder use case
  const reminderRepository = new PrismaReminderRepository();
  const entryRepository = new PrismaEntryRepository();
  const queuePort = new BullMQAdapter();

  const createReminder = new CreateReminder(reminderRepository, entryRepository, queuePort);
  const result = await createReminder.execute({ userId, entryId, scheduledAt, channel, message });

  await queuePort.close();

  if (result.isErr()) {
    const { code, message } = result.error;
    let statusCode = 400;
    if (code === "NOT_FOUND") statusCode = 404;
    else if (code === "CONFLICT") statusCode = 409;
    return NextResponse.json({ error: { code, message } }, { status: statusCode });
  }

  return NextResponse.json({ reminder: result.value }, { status: 201 });
}
