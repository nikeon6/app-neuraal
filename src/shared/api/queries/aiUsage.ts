/**
 * TanStack Query hook for AI usage overview (read-only).
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../apiClient";

export interface AiUsageItem {
  action: string;
  month: string;
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  maxActivePerUser: number;
  rateLimitPerMinute: number;
  maxInputChars: number;
  maxInputBytes: number;
}

export interface AiUsageOverview {
  month: string;
  items: AiUsageItem[];
}

export const aiUsageQueryKey = ["ai-usage"] as const;

const STALE_TIME_MS = 30_000; // 30s
const REFETCH_INTERVAL_MS = 60_000; // 1 min

/**
 * Fetches AI usage overview for all actions.
 */
export function useAiUsageOverviewQuery() {
  return useQuery({
    queryKey: aiUsageQueryKey,
    queryFn: () => apiFetch<AiUsageOverview>("/api/ai/usage"),
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
