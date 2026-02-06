/**
 * TanStack Query hooks for entries (read-only).
 * Mutations use SDK directly + queryClient.invalidateQueries.
 */

import { useMemo } from "react";
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
 * Stable empty array to avoid creating new references when a date has no data.
 */
const EMPTY: ApiEntry[] = [];

/**
 * Entries for multiple dates (e.g. month for calendar / floating topics).
 * Returns a **referentially stable** map dateKey -> ApiEntry[] and combined isPending.
 *
 * The returned `entriesByDate` is memoized so child components receiving it as
 * a prop (FloatingTopics, VerticalCalendar) don't re-render when the reference
 * hasn't actually changed.
 */
export function useEntriesForDates(dateKeys: string[]) {
  const results = useQueries({
    queries: dateKeys.map((key) => ({
      queryKey: entriesQueryKey(key),
      queryFn: () => sdk.listEntriesByDate(key),
      staleTime: STALE_TIME_MS,
    })),
  });

  const isPending = results.some((r) => r.isPending);

  // Memoize using the individual data arrays as deps (they are referentially
  // stable from TanStack Query when data hasn't changed).
  const dataArrays = results.map((r) => r.data);
  const entriesByDate = useMemo(() => {
    const map: Record<string, ApiEntry[]> = {};
    dateKeys.forEach((key, i) => {
      map[key] = dataArrays[i] ?? EMPTY;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataArrays items are stable refs
  }, [...dataArrays, dateKeys]);

  return { entriesByDate, isPending };
}
