/**
 * Hook to load entries for the currently selected date.
 *
 * Automatically fetches when `selectedDate` changes.
 * Also triggers a background fetch for the full month so the
 * calendar and floating topics have data.
 *
 * @example
 * const { entries, isLoading, dateKey } = useEntries();
 */
"use client";

import { useEffect } from "react";
import { useStore, selectDateKey } from "@/shared/store";

export function useEntries() {
  const selectedDate = useStore((s) => s.selectedDate);
  const dateKey = useStore(selectDateKey);
  const entriesByDate = useStore((s) => s.entriesByDate);
  const loadingDates = useStore((s) => s.loadingDates);
  const fetchEntriesByDate = useStore((s) => s.fetchEntriesByDate);
  const fetchMonthEntries = useStore((s) => s.fetchMonthEntries);

  const entries = entriesByDate[dateKey] || [];
  const isLoading = loadingDates.includes(dateKey);

  // Fetch entries for the selected date
  useEffect(() => {
    if (!(dateKey in entriesByDate) && !loadingDates.includes(dateKey)) {
      fetchEntriesByDate(dateKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // Fetch the full month in the background (for calendar pills + floating topics)
  useEffect(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    fetchMonthEntries(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  return { entries, isLoading, dateKey };
}
