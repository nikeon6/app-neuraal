/**
 * TanStack Query hooks for entry attachments (read-only).
 * Mutations use SDK directly + queryClient.invalidateQueries.
 */

import { useQuery } from "@tanstack/react-query";
import * as attachmentsSdk from "../sdk/attachments";

/**
 * Query key factory for attachments.
 * Shape: ["attachments", entryId]
 */
export const attachmentsQueryKey = (entryId: string) =>
  ["attachments", entryId] as const;

const STALE_TIME_MS = 15 * 1000; // 15s

/**
 * Fetches attachments + usage/quota data for an entry.
 * Enabled only when entryId is truthy.
 */
export function useEntryAttachmentsQuery(entryId: string | null | undefined) {
  return useQuery({
    queryKey: attachmentsQueryKey(entryId ?? ""),
    queryFn: () => attachmentsSdk.listByEntry(entryId!),
    enabled: !!entryId,
    staleTime: STALE_TIME_MS,
  });
}
