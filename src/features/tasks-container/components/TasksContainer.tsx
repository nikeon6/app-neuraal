"use client";

import React, { useCallback, useRef, useMemo, memo, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Plus, GripVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore, selectDateKey } from "@/shared/store";
import { useEntriesByDateQuery } from "@/shared/api/queries";
import { createEntryAndInvalidate } from "@/shared/api/mutations";
import { TaskEditor } from "@/features/task-editor";
import type { ApiEntry } from "@/shared/api/sdk";
import { useAutoScrollOnDrag, useOrderedTaskIds } from "../hooks";

// Import scrollbar styles (moved to CSS file for better performance)
import "../styles/scrollbar.css";

// ============================================================================
// PERFORMANCE NOTES
// ============================================================================
/**
 * WHY THIS REFACTOR IS FASTER:
 *
 * - Reorder.Group handles drag internally with motion values (no React state per-pixel)
 * - Items animate via transforms (GPU-accelerated, no layout thrashing)
 * - Only onReorder callback fires when order actually changes
 * - RAF-based auto-scroll runs independently of React render cycle
 * - TaskEditorWrapper is memoized - only re-renders if entry data changes
 * - Store is updated ONCE on drag end, not during drag
 */

// ============================================================================
// TaskEditorWrapper Component (Memoized for performance)
// ============================================================================
interface TaskEditorWrapperProps {
  entry: ApiEntry;
  dragControls: ReturnType<typeof useDragControls>;
  onExpand: (element: HTMLDivElement) => void;
  isDragDisabled: boolean;
}

/**
 * Memoized wrapper for TaskEditor with drag handle.
 * Only re-renders when entry data actually changes.
 */
const TaskEditorWrapper = memo(function TaskEditorWrapper({
  entry,
  dragControls,
  onExpand,
  isDragDisabled,
}: TaskEditorWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle TaskEditor expansion - notify parent for auto-scroll
  const handleEditorClick = useCallback(() => {
    // Small delay to let TaskEditor expand first
    setTimeout(() => {
      if (wrapperRef.current) {
        onExpand(wrapperRef.current);
      }
    }, 250);
  }, [onExpand]);

  // Handle pointer down on drag handle to initiate drag
  // stopPropagation prevents the wrapper onClick (expand) from firing
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isDragDisabled) return;
      dragControls.start(e);
    },
    [dragControls, isDragDisabled]
  );

  return (
    <div ref={wrapperRef} className="relative" onClick={handleEditorClick}>
      {/* Drag Handle */}
      <button
        type="button"
        data-testid="drag-handle"
        aria-label="Drag to reorder"
        title="Arrastrar para reordenar"
        onPointerDown={handlePointerDown}
        className="
          absolute -left-8 top-4 z-10
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          [@media(hover:none)]:opacity-60 [@media(pointer:coarse)]:opacity-60
          active:opacity-100
          text-white/30 hover:text-white/60
          cursor-grab active:cursor-grabbing
          transition-opacity duration-200
          p-3 -m-2 rounded-lg
          touch-none select-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
        "
        style={{ touchAction: "none" }}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* TaskEditor */}
      <TaskEditor
        entry={entry}
      />
    </div>
  );
});

// ============================================================================
// ReorderableTaskItem Component
// ============================================================================
interface ReorderableTaskItemProps {
  entry: ApiEntry;
  onExpand: (element: HTMLDivElement) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  updatePointerY: (y: number) => void;
}

function ReorderableTaskItem({
  entry,
  onExpand,
  onDragStart,
  onDragEnd,
  updatePointerY,
}: ReorderableTaskItemProps) {
  const dragControls = useDragControls();
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    onDragStart();
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    onDragEnd();
  }, [onDragEnd]);

  const handleDrag = useCallback(
    (_: unknown, info: { point: { y: number } }) => {
      updatePointerY(info.point.y);
    },
    [updatePointerY]
  );

  return (
    <Reorder.Item
      value={entry.id}
      data-testid={`task-editor-wrapper-${entry.id}`}
      data-completed={entry.completed ? "true" : "false"}
      role="listitem"
      dragListener={false}
      dragControls={dragControls}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrag={handleDrag}
      layout
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      whileDrag={{
        opacity: 0.9,
        scale: 1.02,
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.4)",
        zIndex: 50,
      }}
      transition={{
        layout: {
          type: "spring",
          stiffness: 350,
          damping: 30,
        },
      }}
      className="group relative"
    >
      <TaskEditorWrapper
        entry={entry}
        dragControls={dragControls}
        onExpand={onExpand}
        isDragDisabled={false}
      />
    </Reorder.Item>
  );
}

// ============================================================================
// TasksContainer Component
// ============================================================================

export function TasksContainer() {
  const queryClient = useQueryClient();
  const dateKey = useStore(selectDateKey);
  const { data: entries = [], isPending: isLoading } = useEntriesByDateQuery(dateKey);
  // Create a map for quick entry lookup by ID
  const entryMap = useMemo(() => {
    const map = new Map<string, ApiEntry>();
    entries.forEach((e) => map.set(e.id, e));
    return map;
  }, [entries]);

  // Ordered entry IDs with local drag state
  const { orderedIds, setOrderedIds, commitOrder } = useOrderedTaskIds({
    tasks: entries,
    selectedDay: dateKey,
    onReorder: () => {
      // TODO: Implement server-side reorder if needed.
      // For now, reorder is local-only during a session.
    },
  });

  // Auto-scroll during drag
  const {
    containerRef,
    startAutoScroll,
    stopAutoScroll,
    updatePointerPosition,
  } = useAutoScrollOnDrag({
    edgeThreshold: 60,
    maxScrollSpeed: 12,
  });

  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    startAutoScroll();
  }, [startAutoScroll]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    stopAutoScroll();
    commitOrder();
  }, [stopAutoScroll, commitOrder]);

  // Handle add new entry — topic defaults to null so TaskEditor shows "Auto"
  const handleAddTask = useCallback(async () => {
    await createEntryAndInvalidate(queryClient, {
      date: dateKey,
      type: "task",
      title: "New task",
      content: {} as Record<string, never>,
      topicId: null,
    });

    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);
  }, [dateKey, queryClient, containerRef]);

  // Handle TaskEditor expansion - auto-scroll to show expanded content
  const handleTaskExpand = useCallback(
    (element: HTMLDivElement) => {
      if (isDraggingRef.current) return;
      if (!containerRef.current || !element) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      const elementBottom = elementRect.bottom;
      const containerBottom = containerRect.bottom;
      const elementTop = elementRect.top;
      const containerTop = containerRect.top;

      if (elementBottom > containerBottom) {
        const overflow = elementBottom - containerBottom;
        const maxScroll = elementTop - containerTop;
        const scrollAmount = Math.min(overflow + 20, maxScroll);

        container.scrollBy({
          top: scrollAmount,
          behavior: "smooth",
        });
      }
    },
    [containerRef]
  );

  // ---------------------------------------------------------------------------
  // Scroll-to-entry: when navigating from notification center, scroll to the
  // target entry and briefly highlight it so the user knows which one it is.
  // ---------------------------------------------------------------------------
  const scrollToEntryId = useStore((s) => s.scrollToEntryId);
  const setScrollToEntryId = useStore((s) => s.setScrollToEntryId);

  useEffect(() => {
    if (!scrollToEntryId) return;

    // The entry may not be in the DOM yet (date change triggers a query refetch).
    // Poll briefly for the element to appear, then scroll.
    let attempts = 0;
    const maxAttempts = 20; // ~2 seconds max
    const intervalMs = 100;

    const timer = setInterval(() => {
      attempts++;
      const container = containerRef.current as HTMLElement | null;
      const el = document.querySelector(
        `[data-testid="task-editor-wrapper-${scrollToEntryId}"]`
      ) as HTMLElement | null;

      if (el && container) {
        clearInterval(timer);

        // Calculate scroll position within the container only (avoid scrollIntoView
        // which also scrolls ancestor containers and breaks the page layout).
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elRelativeTop = elRect.top - containerRect.top + container.scrollTop;
        // Center the element vertically in the container
        const targetScroll = elRelativeTop - containerRect.height / 2 + elRect.height / 2;

        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth",
        });

        // Brief highlight flash
        el.classList.add("scroll-highlight");
        setTimeout(() => el.classList.remove("scroll-highlight"), 1800);

        // Clear the store so it doesn't re-trigger
        setScrollToEntryId(null);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        setScrollToEntryId(null);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [scrollToEntryId, setScrollToEntryId, containerRef]);

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div
        data-testid="tasks-container"
        role="list"
        className="flex flex-col h-full w-full pl-10"
      >
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40 text-sm animate-pulse">Loading entries...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div
        data-testid="tasks-container"
        role="list"
        className="flex flex-col h-full w-full pl-10"
      >
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          data-testid="tasks-scroll-container"
          className="flex-1 overflow-y-auto tasks-scrollbar"
        >
          <div
            data-testid="tasks-empty-state"
            className="flex flex-col items-start py-8"
          >
            <p className="text-lg text-white/60">No entries for this day</p>
            <p className="text-sm text-white/40 mt-1">
              Click the button below to add one
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="add-task-button"
          onClick={handleAddTask}
          aria-label="Add new task"
          className="
            flex items-center justify-center gap-2 p-4 mt-4
            rounded-2xl border-2 border-dashed border-white/20
            text-white/50 hover:text-white/80 hover:border-white/40
            hover:bg-white/5 transition-all duration-200
          "
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Add entry</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="tasks-container"
      role="list"
      className="flex flex-col h-full w-full"
    >
      {/* Scrollable Entry List with Reorder */}
      <Reorder.Group
        ref={containerRef as React.RefObject<HTMLUListElement>}
        axis="y"
        values={orderedIds}
        onReorder={setOrderedIds}
        data-testid="tasks-scroll-container"
        className="flex-1 overflow-y-auto space-y-4 pr-4 pl-10 tasks-scrollbar"
        layoutScroll
      >
        {orderedIds.map((entryId) => {
          const entry = entryMap.get(entryId);
          if (!entry) return null;

          return (
            <ReorderableTaskItem
              key={entry.id}
              entry={entry}
              onExpand={handleTaskExpand}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              updatePointerY={updatePointerPosition}
            />
          );
        })}
      </Reorder.Group>

      {/* Add Entry Button */}
      <div className="flex justify-center mt-4 mb-2 flex-shrink-0">
        <button
          type="button"
          data-testid="add-task-button"
          onClick={handleAddTask}
          aria-label="Add new task"
          className="
            w-12 h-12 flex items-center justify-center
            rounded-full border-2 border-dashed border-white/20
            text-white/40 hover:text-white/80 hover:border-white/50
            hover:bg-white/10 transition-all duration-200
            hover:scale-110
          "
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
