/**
 * Hook to load topics from the API on mount.
 *
 * Calls `fetchTopics()` once and re-fetches if topics array is empty.
 * Returns { topics, isLoading } for convenience.
 *
 * @example
 * const { topics, isLoading } = useTopics();
 */
"use client";

import { useEffect } from "react";
import { useStore } from "@/shared/store";

export function useTopics() {
  const topics = useStore((s) => s.topics);
  const isLoading = useStore((s) => s.isLoadingTopics);
  const fetchTopics = useStore((s) => s.fetchTopics);

  useEffect(() => {
    // Fetch on mount if we haven't loaded yet
    if (topics.length === 0 && !isLoading) {
      fetchTopics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { topics, isLoading };
}
