/**
 * Mutation helpers: call SDK then invalidate TanStack Query cache.
 * Use with useQueryClient() in components.
 *
 * @example
 * const queryClient = useQueryClient();
 * await createTopicAndInvalidate(queryClient, input);
 */

import type { QueryClient } from "@tanstack/react-query";
import * as topicsSdk from "./sdk/topics";
import * as entriesSdk from "./sdk/entries";
import * as remindersSdk from "./sdk/reminders";
import * as attachmentsSdk from "./sdk/attachments";
import * as stickiesSdk from "./sdk/stickies";
import type {
  CreateTopicBody,
  UpdateTopicBody,
  CreateEntryBody,
  UpdateEntryBody,
  CreateReminderBody,
  UpdateReminderBody,
  CreateStickyBody,
  UpdateStickyBody,
} from "./sdk/types";
import { topicsQueryKey } from "./queries/topics";
import { entriesQueryKey } from "./queries/entries";
import { notificationsQueryKey } from "./queries/notifications";
import { pendingReminderQueryKey } from "./queries/reminders";
import { attachmentsQueryKey } from "./queries/attachments";
import { stickiesQueryKey } from "./queries/stickies";

// ---- Topics ----

export async function createTopicAndInvalidate(
  queryClient: QueryClient,
  input: CreateTopicBody,
) {
  const topic = await topicsSdk.createTopic(input);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
  return topic;
}

export async function updateTopicAndInvalidate(
  queryClient: QueryClient,
  id: string,
  patch: UpdateTopicBody,
) {
  const topic = await topicsSdk.updateTopic(id, patch);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
  return topic;
}

export async function deleteTopicAndInvalidate(
  queryClient: QueryClient,
  id: string,
) {
  await topicsSdk.deleteTopic(id);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
}

// ---- Entries ----

export async function createEntryAndInvalidate(
  queryClient: QueryClient,
  input: CreateEntryBody,
) {
  const entry = await entriesSdk.createEntry(input);
  await queryClient.invalidateQueries({
    queryKey: entriesQueryKey(entry.date),
  });
  return entry;
}

export async function updateEntryAndInvalidate(
  queryClient: QueryClient,
  id: string,
  dateKey: string,
  patch: UpdateEntryBody,
) {
  const entry = await entriesSdk.updateEntry(id, patch);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
  return entry;
}

export async function deleteEntryAndInvalidate(
  queryClient: QueryClient,
  id: string,
  dateKey: string,
) {
  await entriesSdk.deleteEntry(id);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
}

// ---- Reorder ----

export async function reorderEntriesAndInvalidate(
  queryClient: QueryClient,
  dateKey: string,
  orderedIds: string[],
) {
  await entriesSdk.reorderEntries(dateKey, orderedIds);
  // No cache invalidation needed: local order is already correct.
  // Optionally invalidate for safety on next refetch:
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
}

// ---- Summarize ----

export async function summarizeEntryAndInvalidate(
  queryClient: QueryClient,
  entryId: string,
) {
  const result = await entriesSdk.summarizeEntry(entryId);
  // Refresh notifications so the in-progress item shows up quickly
  await queryClient.invalidateQueries({ queryKey: [...notificationsQueryKey] });
  return result;
}

export async function clearSummaryAndInvalidate(
  queryClient: QueryClient,
  entryId: string,
  dateKey: string,
) {
  await entriesSdk.clearSummary(entryId);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
}

// ---- Transcribe ----

export async function requestTranscriptionAndInvalidate(
  queryClient: QueryClient,
  entryId: string,
  youtubeUrl: string,
) {
  const result = await entriesSdk.requestTranscription(entryId, youtubeUrl);
  // Refresh notifications so the in-progress item shows up quickly
  await queryClient.invalidateQueries({ queryKey: [...notificationsQueryKey] });
  return result;
}

// ---- Reminders ----

export async function createReminderAndInvalidate(
  queryClient: QueryClient,
  input: CreateReminderBody,
) {
  const reminder = await remindersSdk.createReminder(input);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...notificationsQueryKey] }),
    queryClient.invalidateQueries({
      queryKey: pendingReminderQueryKey(input.entryId),
    }),
  ]);
  return reminder;
}

export async function updateReminderAndInvalidate(
  queryClient: QueryClient,
  id: string,
  entryId: string,
  patch: UpdateReminderBody,
) {
  const reminder = await remindersSdk.updateReminder(id, patch);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...notificationsQueryKey] }),
    queryClient.invalidateQueries({
      queryKey: pendingReminderQueryKey(entryId),
    }),
  ]);
  return reminder;
}

// ---- Stickies ----

export async function createStickyAndInvalidate(
  queryClient: QueryClient,
  input: CreateStickyBody,
) {
  const sticky = await stickiesSdk.createSticky(input);
  await queryClient.invalidateQueries({ queryKey: stickiesQueryKey });
  return sticky;
}

export async function updateStickyAndInvalidate(
  queryClient: QueryClient,
  id: string,
  patch: UpdateStickyBody,
) {
  const sticky = await stickiesSdk.updateSticky(id, patch);
  await queryClient.invalidateQueries({ queryKey: stickiesQueryKey });
  return sticky;
}

export async function deleteStickyAndInvalidate(
  queryClient: QueryClient,
  id: string,
) {
  await stickiesSdk.deleteSticky(id);
  await queryClient.invalidateQueries({ queryKey: stickiesQueryKey });
}

export async function reorderStickiesAndInvalidate(
  queryClient: QueryClient,
  items: { id: string; sortOrder: number; columnIndex: number }[],
) {
  await stickiesSdk.reorderStickies(items);
  await queryClient.invalidateQueries({ queryKey: stickiesQueryKey });
}

// ---- Attachments ----

export async function deleteAttachmentAndInvalidate(
  queryClient: QueryClient,
  attachmentId: string,
  entryId: string,
) {
  await attachmentsSdk.deleteAttachment(attachmentId);
  await queryClient.invalidateQueries({
    queryKey: attachmentsQueryKey(entryId),
  });
}
