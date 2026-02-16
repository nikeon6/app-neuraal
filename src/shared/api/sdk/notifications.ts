/**
 * Notifications SDK — typed functions for /api/notifications endpoints.
 *
 * All functions use the centralized apiClient (apiFetch / helpers).
 * Types are derived from the OpenAPI spec, never hand-crafted.
 */

import { get, post } from "../apiClient";
import type { ApiNotification } from "./types";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user.
 * Optionally filters by `since` (ISO datetime) to only get newer ones.
 */
export async function listNotifications(params?: {
  since?: string;
}): Promise<ApiNotification[]> {
  const query = params?.since
    ? `?since=${encodeURIComponent(params.since)}`
    : "";
  const data = await get<{ notifications: ApiNotification[] }>(
    `/api/notifications${query}`,
  );
  return data.notifications;
}

// ---------------------------------------------------------------------------
// Mark as read
// ---------------------------------------------------------------------------

/**
 * POST /api/notifications/{id}/read — marks a notification as read.
 */
export async function markNotificationRead(
  id: string,
): Promise<{ success: boolean }> {
  return await post<{ success: boolean }>(`/api/notifications/${id}/read`);
}
