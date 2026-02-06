/**
 * TanStack Query hooks for entries (read-only).
 * Mutations use SDK directly + queryClient.invalidateQueries.
 */

import { useQuery, useQueries } from "@tanstack/react-query";
import * as sdk from "../sdk/entries";
import type { ApiEntry } from "../sdk/types";

export const entriesQueryKey = (dateKey: string) => ["entries", dateKey] as const;

const STALE_TIME_MS = 10 * 1000; // 10s

/**
 * Entries for a single date (selected day).
 */
export function useEntriesByDateQuery(dateKey: string) {
  return useQuery({
    queryKey: entriesQueryKey(dateKey),
    queryFn: () => sdk.listEntriesByDate(dateKey),
    enabled: !!dateKey,
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Entries for multiple dates (e.g. month for calendar / floating topics).
 * Returns a map dateKey -> ApiEntry[] and combined isPending.
 */
export function useEntriesForDates(dateKeys: string[]) {
  const results = useQueries({
    queries: dateKeys.map((key) => ({
      queryKey: entriesQueryKey(key),
      queryFn: () => sdk.listEntriesByDate(key),
      staleTime: STALE_TIME_MS,
    })),
  });

  const entriesByDate: Record<string, ApiEntry[]> = {};
  let isPending = false;

  results.forEach((result, i) => {
    const key = dateKeys[i];
    if (result.data) {
      entriesByDate[key] = result.data;
    } else {
      entriesByDate[key] = [];
    }
    if (result.isPending) isPending = true;
  });

  return { entriesByDate, isPending };
}
