/**
 * TanStack Query hooks for notifications.
 *
 * - useNotificationsQuery: polls every 5s in foreground
 * - notificationsQueryKey: for invalidations from mutations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as sdk from "../sdk/notifications";
import type { ApiNotification } from "../sdk/types";

export const notificationsQueryKey = ["notifications"] as const;

/**
 * Fetch all notifications with polling.
 * In MVP we fetch everything (no "since" optimisation).
 */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => sdk.listNotifications(),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Derived helpers — call with the `data` from useNotificationsQuery.
 */
export function getUnreadCount(notifications: ApiNotification[] | undefined): number {
  if (!notifications) return 0;
  return notifications.filter((n) => n.status === "unread").length;
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
