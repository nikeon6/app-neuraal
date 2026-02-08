/**
 * TanStack Query hooks for API data (read-only).
 * Export query keys for invalidations.
 */

export { useTopicsQuery, topicsQueryKey } from "./topics";
export {
  useEntriesByDateQuery,
  useEntriesForDates,
  entriesQueryKey,
} from "./entries";
export {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useSummaryDoneWatcher,
  notificationsQueryKey,
  getUnreadCount,
} from "./notifications";
