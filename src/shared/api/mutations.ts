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
import type { CreateTopicBody, UpdateTopicBody, CreateEntryBody, UpdateEntryBody } from "./sdk/types";
import { topicsQueryKey } from "./queries/topics";
import { entriesQueryKey } from "./queries/entries";

// ---- Topics ----

export async function createTopicAndInvalidate(
  queryClient: QueryClient,
  input: CreateTopicBody
) {
  const topic = await topicsSdk.createTopic(input);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
  return topic;
}

export async function updateTopicAndInvalidate(
  queryClient: QueryClient,
  id: string,
  patch: UpdateTopicBody
) {
  const topic = await topicsSdk.updateTopic(id, patch);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
  return topic;
}

export async function deleteTopicAndInvalidate(
  queryClient: QueryClient,
  id: string
) {
  await topicsSdk.deleteTopic(id);
  await queryClient.invalidateQueries({ queryKey: topicsQueryKey });
}

// ---- Entries ----

export async function createEntryAndInvalidate(
  queryClient: QueryClient,
  input: CreateEntryBody
) {
  const entry = await entriesSdk.createEntry(input);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(entry.date) });
  return entry;
}

export async function updateEntryAndInvalidate(
  queryClient: QueryClient,
  id: string,
  dateKey: string,
  patch: UpdateEntryBody
) {
  const entry = await entriesSdk.updateEntry(id, patch);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
  return entry;
}

export async function deleteEntryAndInvalidate(
  queryClient: QueryClient,
  id: string,
  dateKey: string
) {
  await entriesSdk.deleteEntry(id);
  await queryClient.invalidateQueries({ queryKey: entriesQueryKey(dateKey) });
}
