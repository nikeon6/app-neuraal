/**
 * Hook to get topics from TanStack Query.
 * Prefer useTopicsQuery() from @/shared/api/queries when you need the full query result.
 */
"use client";

import { useTopicsQuery } from "@/shared/api/queries";

export function useTopics() {
  const { data: topics = [], isPending: isLoading } = useTopicsQuery();
  return { topics, isLoading };
}
