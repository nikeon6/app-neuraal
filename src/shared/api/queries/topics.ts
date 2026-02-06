/**
 * TanStack Query hooks for topics (read-only).
 * Mutations use SDK directly + queryClient.invalidateQueries.
 */

import { useQuery } from "@tanstack/react-query";
import * as sdk from "../sdk/topics";

export const topicsQueryKey = ["topics"] as const;

const STALE_TIME_MS = 60 * 1000; // 60s

export function useTopicsQuery() {
  return useQuery({
    queryKey: topicsQueryKey,
    queryFn: () => sdk.listTopics(),
    staleTime: STALE_TIME_MS,
  });
}
