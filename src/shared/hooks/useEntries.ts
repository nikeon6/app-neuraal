/**
 * Hook to get entries for the currently selected date from TanStack Query.
 * Prefer useEntriesByDateQuery(dateKey) from @/shared/api/queries when you need the full query result.
 */
"use client";

import { useStore, selectDateKey } from "@/shared/store";
import { useEntriesByDateQuery } from "@/shared/api/queries";

export function useEntries() {
  const dateKey = useStore(selectDateKey);
  const { data: entries = [], isPending: isLoading } = useEntriesByDateQuery(dateKey);
  return { entries, isLoading, dateKey };
}
