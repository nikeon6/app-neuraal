import type {
  AiUsageRepository,
  AiUsageLedgerEntry,
} from "../ports/AiUsageRepository";

interface MonthlyRow {
  userId: string;
  action: string;
  monthKey: string;
  requestsUsed: number;
  tokensUsed: number;
}

/**
 * In-memory implementation of AiUsageRepository for tests.
 */
export class InMemoryAiUsageRepository implements AiUsageRepository {
  private monthly: Map<string, MonthlyRow> = new Map();
  private ledger: AiUsageLedgerEntry[] = [];

  private monthlyKey(userId: string, action: string, monthKey: string): string {
    return `${userId}:${action}:${monthKey}`;
  }

  async getMonthly(
    userId: string,
    action: string,
    monthKey: string,
  ): Promise<import("../ports/AiUsageRepository").AiUsageMonthlyRecord | null> {
    const row = this.monthly.get(this.monthlyKey(userId, action, monthKey));
    if (!row) return null;
    return { ...row };
  }

  async incrementRequests(
    userId: string,
    action: string,
    monthKey: string,
    delta: number,
  ): Promise<void> {
    const key = this.monthlyKey(userId, action, monthKey);
    const row = this.monthly.get(key);
    if (row) {
      row.requestsUsed += delta;
      if (row.requestsUsed < 0) row.requestsUsed = 0;
    } else {
      this.monthly.set(key, {
        userId,
        action,
        monthKey,
        requestsUsed: Math.max(0, delta),
        tokensUsed: 0,
      });
    }
  }

  async incrementTokens(
    userId: string,
    action: string,
    monthKey: string,
    delta: number,
  ): Promise<void> {
    const key = this.monthlyKey(userId, action, monthKey);
    const row = this.monthly.get(key);
    if (row) {
      row.tokensUsed += delta;
    } else {
      this.monthly.set(key, {
        userId,
        action,
        monthKey,
        requestsUsed: 0,
        tokensUsed: Math.max(0, delta),
      });
    }
  }

  async addLedgerEntry(entry: AiUsageLedgerEntry): Promise<void> {
    this.ledger.push(entry);
  }

  clear(): void {
    this.monthly.clear();
    this.ledger.length = 0;
  }

  getLedger(): unknown[] {
    return [...this.ledger];
  }
}
