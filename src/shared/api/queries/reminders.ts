/**
 * TanStack Query hooks for reminders (read-only).
 * Mutations use SDK directly + queryClient.invalidateQueries.
 */

import { useQuery } from "@tanstack/react-query";
import * as sdk from "../sdk/reminders";

export const pendingReminderQueryKey = (entryId: string) =>
  ["reminders", "pending", entryId] as const;

/**
 * Fetches the first pending reminder for an entry (if any).
 * Returns the reminder or null.
 *
 * @param enabled - Controls when the query fires. Defaults to true.
 *   Pass false to defer the fetch until the caller is ready (e.g. user interaction).
 */
export function usePendingReminderQuery(entryId: string, enabled = true) {
  return useQuery({
    queryKey: pendingReminderQueryKey(entryId),
    queryFn: async () => {
      const reminders = await sdk.listPendingReminders(entryId);
      return reminders.length > 0 ? reminders[0] : null;
    },
    enabled: !!entryId && enabled,
    staleTime: 30_000,
  });
}
