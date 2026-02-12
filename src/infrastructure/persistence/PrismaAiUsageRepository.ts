import type { AiUsageRepository } from "@/application/ports/AiUsageRepository";
import { pool } from "./prisma";

/**
 * PrismaAiUsageRepository implemented with raw SQL via the pg pool.
 * This avoids relying on Prisma client delegates (aiUsageMonthly / aiUsageLedger)
 * which can be undefined in some Next.js/Turbopack contexts.
 */
export class PrismaAiUsageRepository implements AiUsageRepository {
  async getMonthly(
    userId: string,
    action: string,
    monthKey: string
  ): Promise<import("@/application/ports/AiUsageRepository").AiUsageMonthlyRecord | null> {
    if (action !== "SUMMARY") return null;

    const result = await pool.query<{
      user_id: string;
      action: string;
      month_key: string;
      requests_used: number;
      tokens_used: number;
    }>(
      `SELECT user_id, action, month_key, requests_used, tokens_used
       FROM ai_usage_monthly
       WHERE user_id = $1 AND action = $2::"AiActionType" AND month_key = $3`,
      [userId, action, monthKey]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      action: row.action,
      monthKey: row.month_key,
      requestsUsed: row.requests_used,
      tokensUsed: row.tokens_used,
    };
  }

  async incrementRequests(
    userId: string,
    action: string,
    monthKey: string,
    delta: number
  ): Promise<void> {
    if (action !== "SUMMARY") return;

    await pool.query(
      `INSERT INTO ai_usage_monthly (id, user_id, action, month_key, requests_used, tokens_used, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2::"AiActionType", $3, $4, 0, NOW(), NOW())
       ON CONFLICT (user_id, action, month_key)
       DO UPDATE SET requests_used = ai_usage_monthly.requests_used + $4, updated_at = NOW()`,
      [userId, action, monthKey, delta]
    );
  }

  async incrementTokens(
    userId: string,
    action: string,
    monthKey: string,
    delta: number
  ): Promise<void> {
    if (action !== "SUMMARY") return;

    await pool.query(
      `INSERT INTO ai_usage_monthly (id, user_id, action, month_key, requests_used, tokens_used, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2::"AiActionType", $3, 0, $4, NOW(), NOW())
       ON CONFLICT (user_id, action, month_key)
       DO UPDATE SET tokens_used = ai_usage_monthly.tokens_used + $4, updated_at = NOW()`,
      [userId, action, monthKey, delta]
    );
  }

  async addLedgerEntry(entry: {
    userId: string;
    action: string;
    requestId?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costCents?: number;
    metaJson?: Record<string, unknown>;
  }): Promise<void> {
    if (entry.action !== "SUMMARY") return;

    await pool.query(
      `INSERT INTO ai_usage_ledger (id, user_id, action, request_id, model, prompt_tokens, completion_tokens, total_tokens, cost_cents, meta_json, created_at)
       VALUES (gen_random_uuid(), $1, $2::"AiActionType", $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())`,
      [
        entry.userId,
        entry.action,
        entry.requestId ?? null,
        entry.model ?? null,
        entry.promptTokens ?? null,
        entry.completionTokens ?? null,
        entry.totalTokens ?? null,
        entry.costCents ?? null,
        entry.metaJson ? JSON.stringify(entry.metaJson) : null,
      ]
    );
  }
}
