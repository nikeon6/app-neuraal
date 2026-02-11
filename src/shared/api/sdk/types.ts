/**
 * Type helpers derived from the auto-generated OpenAPI types.
 *
 * These provide convenient aliases so SDK functions and UI code
 * can reference API shapes without importing the full openapi-types file.
 */

import type { components, operations } from "../openapi-types";

// ---------------------------------------------------------------------------
// Component Schemas (reusable model types)
// ---------------------------------------------------------------------------

/** Topic entity as returned by the API. */
export type ApiTopic = components["schemas"]["Topic"];

/** Entry entity as returned by the API. */
export type ApiEntry = components["schemas"]["Entry"];

/** Reminder entity as returned by the API. */
export type ApiReminder = components["schemas"]["Reminder"];

/** Notification entity as returned by the API. */
export type ApiNotification = components["schemas"]["Notification"];

/** Attachment entity as returned by the API. */
export type ApiAttachment = components["schemas"]["Attachment"];

/** Sticky entity as returned by the API. */
export type ApiSticky = components["schemas"]["Sticky"];

/** Standard error response shape. */
export type ApiErrorResponse = components["schemas"]["ErrorResponse"];

// ---------------------------------------------------------------------------
// Request body helpers (extract JSON body from an operation)
// ---------------------------------------------------------------------------

/** Request body for creating a topic. */
export type CreateTopicBody =
  operations["createTopic"]["requestBody"]["content"]["application/json"];

/** Request body for updating a topic. */
export type UpdateTopicBody =
  operations["updateTopic"]["requestBody"]["content"]["application/json"];

/** Request body for creating an entry. */
export type CreateEntryBody =
  operations["createEntry"]["requestBody"]["content"]["application/json"];

/** Request body for updating an entry. */
export type UpdateEntryBody =
  operations["updateEntry"]["requestBody"]["content"]["application/json"];

/** Request body for auto-topic assignment. */
export type AutoTopicBody = NonNullable<
  operations["autoAssignTopic"]["requestBody"]
>["content"]["application/json"];

/** Request body for creating a reminder. */
export type CreateReminderBody =
  operations["createReminder"]["requestBody"]["content"]["application/json"];

/** Request body for updating a reminder (reschedule / cancel). */
export type UpdateReminderBody =
  operations["updateReminder"]["requestBody"]["content"]["application/json"];

/** Request body for creating a sticky. */
export type CreateStickyBody =
  operations["createSticky"]["requestBody"]["content"]["application/json"];

/** Request body for updating a sticky. */
export type UpdateStickyBody =
  operations["updateSticky"]["requestBody"]["content"]["application/json"];

// ---------------------------------------------------------------------------
// Response helpers (extract the success JSON payload from an operation)
// ---------------------------------------------------------------------------

/**
 * Extracts the success JSON body from an operation's responses.
 * Checks 200, 201, 202 in order.
 */
type JsonBody<T> = T extends {
  content: { "application/json": infer R };
}
  ? R
  : never;

type Responses<Op> = Op extends { responses: infer R } ? R : never;

export type SuccessBody<Op> =
  Responses<Op> extends { 200: infer R }
    ? JsonBody<R>
    : Responses<Op> extends { 201: infer R }
      ? JsonBody<R>
      : Responses<Op> extends { 202: infer R }
        ? JsonBody<R>
        : never;

/** Typed success response for a given operationId. */
export type OpSuccess<K extends keyof operations> = SuccessBody<operations[K]>;
