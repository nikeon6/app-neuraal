import { NextRequest, NextResponse } from "next/server";
import { GetAiUsage } from "@/application/use-cases/ai/GetAiUsage";
import { PrismaAiUsageRepository } from "@/infrastructure/persistence/PrismaAiUsageRepository";
import { SystemClock } from "@/infrastructure/auth/SystemClock";
import { getAuthUserId } from "@/infrastructure/auth/getAuthUserId";
import { getAiGuardrailsConfig } from "@/infrastructure/config/AiGuardrailsConfig";

/**
 * GET /api/ai/usage
 * Returns current AI usage and limits for the authenticated user.
 * Query: action=SUMMARY (default), month=YYYY-MM (default current).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await getAuthUserId(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { userId } = authResult;
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action") ?? "SUMMARY";
  const month = searchParams.get("month") ?? undefined;

  const config = getAiGuardrailsConfig();
  const getAiUsage = new GetAiUsage(
    new PrismaAiUsageRepository(),
    new SystemClock(),
    {
      monthlyQuotaRequests: config.summaryMonthlyQuotaRequests,
      monthlyQuotaTokens: config.summaryMonthlyQuotaTokens,
      maxActivePerUser: config.summaryMaxActivePerUser,
      rateLimitPerMinute: config.summaryRateLimitPerMinute,
      maxInputChars: config.summaryMaxInputChars,
    }
  );

  const output = await getAiUsage.execute({ userId, action, month });

  return NextResponse.json(output);
}
