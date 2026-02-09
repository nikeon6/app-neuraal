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

  // Memoize using a stable fingerprint of the data so the dependency array
  // has a fixed size regardless of how many dateKeys there are.
  // dataUpdatedAt changes whenever TanStack Query updates a specific key's data.
  const dataFingerprint = results.map((r) => r.dataUpdatedAt).join(",");
  const dateKeysFingerprint = dateKeys.join(",");

  const entriesByDate = useMemo(() => {
    const map: Record<string, ApiEntry[]> = {};
    dateKeys.forEach((key, i) => {
      map[key] = results[i]?.data ?? EMPTY;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprints track actual data changes
  }, [dataFingerprint, dateKeysFingerprint]);

  return { entriesByDate, isPending };
}
