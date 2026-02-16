/**
 * Reminders SDK — typed functions for /api/reminders endpoints.
 *
 * All functions use the centralized apiClient (apiFetch / helpers).
 * Types are derived from the OpenAPI spec, never hand-crafted.
 */

import { post, patch } from "../apiClient";
import type {
  ApiReminder,
  CreateReminderBody,
  UpdateReminderBody,
} from "./types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** POST /api/reminders — creates a new reminder for an entry. */
export async function createReminder(
  input: CreateReminderBody,
): Promise<ApiReminder> {
  const data = await post<{ reminder: ApiReminder }>("/api/reminders", input);
  return data.reminder;
}

// ---------------------------------------------------------------------------
// Update (reschedule / cancel)
// ---------------------------------------------------------------------------

/**
 * PATCH /api/reminders/{id} — updates a reminder.
 * Use `{ status: "canceled" }` to cancel.
 */
export async function updateReminder(
  id: string,
  input: UpdateReminderBody,
): Promise<ApiReminder> {
  const data = await patch<{ reminder: ApiReminder }>(
    `/api/reminders/${id}`,
    input,
  );
  return data.reminder;
}
