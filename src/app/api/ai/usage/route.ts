import { NextRequest, NextResponse } from "next/server";
import { GetAiUsage } from "@/application/use-cases/ai/GetAiUsage";
import type { ActionConfigForUsage } from "@/application/use-cases/ai/GetAiUsage";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";

/**
 * Builds ActionConfigForUsage[] from the full guardrails config.
 */
function buildActionConfigs(): ActionConfigForUsage[] {
  const config = getAiGuardrailsConfig();
  return [
    {
      action: "SUMMARY",
      monthlyQuotaRequests: config.summary.monthlyQuotaRequests,
      monthlyQuotaTokens: config.summary.monthlyQuotaTokens,
      maxActivePerUser: config.summary.maxActivePerUser,
      rateLimitPerMinute: config.summary.rateLimitPerMinute,
      maxInputChars: config.summary.maxInputChars,
      maxInputBytes: 0,
    },
    {
      action: "TRANSCRIPT_YOUTUBE",
      monthlyQuotaRequests: config.transcriptYoutube.monthlyQuotaRequests,
      monthlyQuotaTokens: config.transcriptYoutube.monthlyQuotaTokens,
      maxActivePerUser: config.transcriptYoutube.maxActivePerUser,
      rateLimitPerMinute: config.transcriptYoutube.rateLimitPerMinute,
      maxInputChars: config.transcriptYoutube.maxInputChars,
      maxInputBytes: 0,
    },
    {
      action: "OCR_IMAGE",
      monthlyQuotaRequests: config.ocrImage.monthlyQuotaRequests,
      monthlyQuotaTokens: config.ocrImage.monthlyQuotaTokens,
      maxActivePerUser: config.ocrImage.maxActivePerUser,
      rateLimitPerMinute: config.ocrImage.rateLimitPerMinute,
      maxInputChars: 0,
      maxInputBytes: config.ocrImage.maxInputBytes,
    },
    {
      action: "REMINDER_WHATSAPP",
      monthlyQuotaRequests: config.reminderWhatsapp.monthlyQuotaRequests,
      monthlyQuotaTokens: 0,
      maxActivePerUser: config.reminderWhatsapp.maxActivePerUser,
      rateLimitPerMinute: config.reminderWhatsapp.rateLimitPerMinute,
      maxInputChars: config.reminderWhatsapp.maxInputChars,
      maxInputBytes: 0,
    },
  ];
}

/**
 * GET /api/ai/usage
 * Returns current AI usage and limits for the authenticated user.
 * Query: action=SUMMARY (single action) or omit for overview of all actions.
 *        month=YYYY-MM (default current).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  const getAiUsage = new GetAiUsage(
    new PrismaAiUsageRepository(),
    new SystemClock(),
    buildActionConfigs()
  );

  const output = await getAiUsage.execute({ userId, action, month });

  return NextResponse.json(output);
}
