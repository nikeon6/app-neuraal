/**
 * TanStack Query hook for user storage usage (read-only).
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../apiClient";

export interface StorageUsageData {
  /** Total bytes currently used by the user's attachments */
  usedBytes: number;
  /** Maximum bytes allowed per user (global quota) */
  maxUserStorageBytes: number;
  /** Maximum bytes allowed per entry */
  maxEntryAttachmentBytes: number;
}

export const storageUsageQueryKey = ["storage-usage"] as const;

const STALE_TIME_MS = 30_000; // 30s
const REFETCH_INTERVAL_MS = 60_000; // 1 min

/**
 * Fetches the authenticated user's storage usage and limits.
 */
export function useStorageUsageQuery() {
  return useQuery({
    queryKey: storageUsageQueryKey,
    queryFn: () => apiFetch<StorageUsageData>("/api/storage/usage"),
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
