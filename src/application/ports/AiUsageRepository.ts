/**
 * Monthly usage record for a user/action.
 */
export interface AiUsageMonthlyRecord {
  userId: string;
  action: string; // "SUMMARY" | future actions
  monthKey: string;
  requestsUsed: number;
  tokensUsed: number;
}

/**
 * Ledger entry for a single AI request (audit/cost).
 */
export interface AiUsageLedgerEntry {
  userId: string;
  action: string;
  requestId?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costCents?: number;
  metaJson?: Record<string, unknown>;
}

/**
 * Port for AI usage persistence (monthly quotas + ledger).
 */
export interface AiUsageRepository {
  /**
   * Gets monthly usage for a user/action/month. Returns null if no record.
   */
  getMonthly(
    userId: string,
    action: string,
    monthKey: string,
  ): Promise<AiUsageMonthlyRecord | null>;

  /**
   * Increments requests used by delta (can be negative to revert).
   */
  incrementRequests(
    userId: string,
    action: string,
    monthKey: string,
    delta: number,
  ): Promise<void>;

  /**
   * Increments tokens used by delta.
   */
  incrementTokens(
    userId: string,
    action: string,
    monthKey: string,
    delta: number,
  ): Promise<void>;

  /**
   * Appends a ledger entry for audit/cost tracking.
   */
  addLedgerEntry(entry: AiUsageLedgerEntry): Promise<void>;
}
