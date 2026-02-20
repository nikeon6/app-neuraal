/**
 * TanStack Query hooks for notifications.
 *
 * - useNotificationsQuery: polls every 5s in foreground
 * - notificationsQueryKey: for invalidations from mutations
 */

import { useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as sdk from "../sdk/notifications";
import type { ApiNotification } from "../sdk/types";
import { entriesQueryKey } from "./entries";

export const notificationsQueryKey = ["notifications"] as const;

const NOTIFICATIONS_LOOKBACK_DAYS = 7;

function getSinceDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Fetch notifications from the last week with polling (every 5s).
 */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () =>
      sdk.listNotifications({
        since: getSinceDateDaysAgo(NOTIFICATIONS_LOOKBACK_DAYS),
      }),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Derived helpers — call with the `data` from useNotificationsQuery.
 */
export function getUnreadCount(
  notifications: ApiNotification[] | undefined,
): number {
  if (!notifications) return 0;
  return notifications.filter((n) => n.status === "unread").length;
}

/**
 * Mutation: mark a notification as read, then refresh the list.
 */
/**
 * Watches for SUMMARY_DONE notifications and auto-invalidates the entries query
 * for the given dateKey so the TaskEditor picks up the new summary.
 */
export function useSummaryDoneWatcher(dateKey: string) {
  const queryClient = useQueryClient();
  const { data: notifications } = useNotificationsQuery();
  // Track known SUMMARY_DONE notification IDs so we only react to new ones
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifications) return;

    const summaryDone = notifications.filter(
      (n) => n.type === "SUMMARY_DONE" && !knownIdsRef.current.has(n.id),
    );

    if (summaryDone.length > 0) {
      // Add all current SUMMARY_DONE ids to known set
      for (const n of notifications) {
        if (n.type === "SUMMARY_DONE") {
          knownIdsRef.current.add(n.id);
        }
      }
      // Invalidate entries so TaskEditor picks up the summary
      void queryClient.invalidateQueries({
        queryKey: entriesQueryKey(dateKey),
      });
    }
  }, [notifications, dateKey, queryClient]);
}

/**
 * Watches for TRANSCRIPTION_DONE notifications and auto-invalidates the entries
 * query for the given dateKey so the TaskEditor picks up the new transcription
 * (injected into the YouTube node in the entry content JSON).
 */
export function useTranscriptionDoneWatcher(dateKey: string) {
  const queryClient = useQueryClient();
  const { data: notifications } = useNotificationsQuery();
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifications) return;

    const transcriptionDone = notifications.filter(
      (n) => n.type === "TRANSCRIPTION_DONE" && !knownIdsRef.current.has(n.id),
    );

    if (transcriptionDone.length > 0) {
      for (const n of notifications) {
        if (n.type === "TRANSCRIPTION_DONE") {
          knownIdsRef.current.add(n.id);
        }
      }
      void queryClient.invalidateQueries({
        queryKey: entriesQueryKey(dateKey),
      });
    }
  }, [notifications, dateKey, queryClient]);
}

/**
 * Mutation: mark a notification as read, then refresh the list.
 */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sdk.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}
