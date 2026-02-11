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
  useTranscriptionDoneWatcher,
  notificationsQueryKey,
  getUnreadCount,
} from "./notifications";
export { useEntryAttachmentsQuery, attachmentsQueryKey } from "./attachments";
export { useStickiesQuery, stickiesQueryKey } from "./stickies";