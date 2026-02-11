/**
 * Stickies SDK — typed functions for /api/stickies endpoints.
 */

import { get, post, patch, del } from "../apiClient";
import type { ApiSticky, CreateStickyBody, UpdateStickyBody } from "./types";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** GET /api/stickies — returns all stickies for the authenticated user. */
export async function listStickies(): Promise<ApiSticky[]> {
  const data = await get<{ stickies: ApiSticky[] }>("/api/stickies");
  return data.stickies;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** POST /api/stickies — creates a new sticky. */
export async function createSticky(input: CreateStickyBody): Promise<ApiSticky> {
  const data = await post<{ sticky: ApiSticky }>("/api/stickies", input);
  return data.sticky;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** PATCH /api/stickies/{id} — updates an existing sticky. */
export async function updateSticky(
  id: string,
  input: UpdateStickyBody
): Promise<ApiSticky> {
  const data = await patch<{ sticky: ApiSticky }>(`/api/stickies/${id}`, input);
  return data.sticky;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** DELETE /api/stickies/{id} — deletes a sticky. */
export async function deleteSticky(id: string): Promise<void> {
  await del(`/api/stickies/${id}`);
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

/** PATCH /api/stickies/reorder — bulk-updates sortOrder and columnIndex. */
export async function reorderStickies(
  items: { id: string; sortOrder: number; columnIndex: number }[]
): Promise<void> {
  await patch("/api/stickies/reorder", { items });
}
