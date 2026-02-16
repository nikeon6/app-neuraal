import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook to manage ordered task IDs with sync to store.
 *
 * WHY THIS EXISTS:
 * - Maintains local order state that can change during drag without triggering store updates
 * - Syncs with store when tasks change (new tasks added, tasks removed, day changes)
 * - Only persists to store on explicit commit (drag end)
 * - Handles edge cases: new tasks append to end, removed tasks are filtered out
 */

interface UseOrderedTaskIdsOptions {
  /** Array of items with at least an `id` field (ApiEntry, LegacyTask, etc.). */
  tasks: ReadonlyArray<{ id: string }>;
  /** Key that changes when the list context changes (e.g. dateKey or day number). */
  selectedDay: number | string;
  /** Called with the new ID order when committed (drag end). */
  onReorder: (day: number | string, newOrder: string[]) => void;
}

interface UseOrderedTaskIdsReturn {
  /** Current ordered array of task IDs */
  orderedIds: string[];
  /** Update order during drag (does NOT persist to store) */
  setOrderedIds: (ids: string[]) => void;
  /** Commit current order to store (call on drag end) */
  commitOrder: () => void;
  /** Check if order has changed from store */
  hasOrderChanged: () => boolean;
}

export function useOrderedTaskIds({
  tasks,
  selectedDay,
  onReorder,
}: UseOrderedTaskIdsOptions): UseOrderedTaskIdsReturn {
  // Current ordered IDs (local state for drag)
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    tasks.map((t) => t.id),
  );

  // Track the original order from store to detect changes
  const originalOrderRef = useRef<string[]>(tasks.map((t) => t.id));

  // Track selected day to detect day changes
  const prevSelectedDayRef = useRef<number | string>(selectedDay);

  // Sync with store when tasks or day changes
  useEffect(() => {
    const taskIds = tasks.map((t) => t.id);
    const dayChanged = prevSelectedDayRef.current !== selectedDay;
    prevSelectedDayRef.current = selectedDay;

    if (dayChanged) {
      // Day changed - reset to store order
      setOrderedIds(taskIds);
      originalOrderRef.current = taskIds;
      return;
    }

    // Same day - handle task additions/removals
    const currentIdSet = new Set(taskIds);
    const orderedIdSet = new Set(orderedIds);

    // Find new tasks (in store but not in our order)
    const newTaskIds = taskIds.filter((id) => !orderedIdSet.has(id));

    // Filter out removed tasks (in our order but not in store)
    const filteredIds = orderedIds.filter((id) => currentIdSet.has(id));

    // Append new tasks at the end
    const newOrderedIds = [...filteredIds, ...newTaskIds];

    // Only update if something changed
    if (
      newOrderedIds.length !== orderedIds.length ||
      newOrderedIds.some((id, i) => orderedIds[i] !== id)
    ) {
      setOrderedIds(newOrderedIds);
    }

    // Update original order reference
    originalOrderRef.current = taskIds;
  }, [tasks, selectedDay, orderedIds]);

  // Check if current order differs from original
  const hasOrderChanged = useCallback((): boolean => {
    const original = originalOrderRef.current;
    if (original.length !== orderedIds.length) return true;
    return orderedIds.some((id, i) => original[i] !== id);
  }, [orderedIds]);

  // Commit order to store
  const commitOrder = useCallback(() => {
    if (hasOrderChanged()) {
      onReorder(selectedDay, orderedIds);
      originalOrderRef.current = orderedIds;
    }
  }, [hasOrderChanged, onReorder, selectedDay, orderedIds]);

  return {
    orderedIds,
    setOrderedIds,
    commitOrder,
    hasOrderChanged,
  };
}
