"use client";

import React, { useCallback, useRef, useMemo, memo } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Plus, GripVertical } from "lucide-react";
import { useStore } from "@/shared/store";
import { TaskEditor } from "@/features/task-editor";
import type { LegacyTask, DefaultTopicId } from "@/shared/types";
import { isDefaultTopicId } from "@/shared/lib";
import { useAutoScrollOnDrag, useOrderedTaskIds } from "../hooks";

// Import scrollbar styles (moved to CSS file for better performance)
import "../styles/scrollbar.css";

// ============================================================================
// PERFORMANCE NOTES
// ============================================================================
/**
 * WHY THIS REFACTOR IS FASTER:
 *
 * BEFORE (HTML5 Drag & Drop):
 * - onDragOver fired 60+ times/second, each calling setState → massive re-renders
 * - AnimatePresence on each item created/destroyed DOM nodes constantly
 * - setInterval for auto-scroll was recreated on every dragOver event
 * - Every pixel of movement triggered React reconciliation
 *
 * AFTER (Framer Motion Reorder):
 * - Reorder.Group handles drag internally with motion values (no React state per-pixel)
 * - Items animate via transforms (GPU-accelerated, no layout thrashing)
 * - Only onReorder callback fires when order actually changes
 * - RAF-based auto-scroll runs independently of React render cycle
 * - TaskEditorWrapper is memoized - only re-renders if task data changes
 * - Store is updated ONCE on drag end, not during drag
 */

// ============================================================================
// TaskEditorWrapper Component (Memoized for performance)
// ============================================================================
interface TaskEditorWrapperProps {
  task: LegacyTask;
  dragControls: ReturnType<typeof useDragControls>;
  onExpand: (element: HTMLDivElement) => void;
  isDragDisabled: boolean;
}

/**
 * Memoized wrapper for TaskEditor with drag handle.
 * Only re-renders when task data actually changes.
 */
const TaskEditorWrapper = memo(function TaskEditorWrapper({
  task,
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
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDragDisabled) return;
      dragControls.start(e);
    },
    [dragControls, isDragDisabled]
  );

  return (
    <div ref={wrapperRef} className="relative" onClick={handleEditorClick}>
      {/* Drag Handle - positioned on the left */}
      <div
        data-testid="drag-handle"
        aria-label="Drag to reorder"
        onPointerDown={handlePointerDown}
        className="
          absolute -left-8 top-4
          opacity-0 group-hover:opacity-100
          text-white/30 hover:text-white/60
          cursor-grab active:cursor-grabbing
          transition-opacity duration-200
          p-1 z-10
          touch-none
        "
        style={{ touchAction: "none" }}
      >
        <GripVertical className="w-5 h-5" />
      </div>

      {/* TaskEditor - props are stable, won't cause re-render */}
      <TaskEditor
        entryId={task.id}
        initialTitle={task.title}
        initialTopic={isDefaultTopicId(task.topicId) ? task.topicId : "auto"}
        initialEntryType="task"
        initialCompleted={task.completed}
      />
    </div>
  );
});

// ============================================================================
// ReorderableTaskItem Component
// ============================================================================
interface ReorderableTaskItemProps {
  task: LegacyTask;
  onExpand: (element: HTMLDivElement) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  updatePointerY: (y: number) => void;
}

/**
 * Individual reorderable task item using Framer Motion's Reorder.Item.
 * Handles its own drag controls for handle-only dragging.
 */
function ReorderableTaskItem({
  task,
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
      value={task.id}
      data-testid={`task-editor-wrapper-${task.id}`}
      data-completed={task.completed ? "true" : "false"}
      role="listitem"
      dragListener={false}
      dragControls={dragControls}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrag={handleDrag}
      // Smooth spring animation for reordering
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
        task={task}
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

/**
 * TasksContainer - High-performance container for TaskEditors with drag reordering.
 *
 * Features:
 * - 60fps smooth drag reordering via Framer Motion Reorder
 * - Handle-only dragging (GripVertical icon)
 * - Auto-scroll when dragging near container edges (RAF-based)
 * - Persists order to store only on drag end (not during drag)
 * - Memoized TaskEditors prevent unnecessary re-renders
 * - Auto-scroll when TaskEditor expands at bottom
 *
 * @component
 */
export function TasksContainer() {
  const selectedDay = useStore((s) => s.selectedDay);
  const tasksByDay = useStore((s) => s.tasksByDay);
  const addTask = useStore((s) => s.addTask);
  const reorderTasks = useStore((s) => s.reorderTasks);

  // Get tasks for selected day
  const tasks = tasksByDay[selectedDay] || [];

  // Create a map for quick task lookup by ID
  const taskMap = useMemo(() => {
    const map = new Map<string, LegacyTask>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Ordered task IDs with sync to store
  const { orderedIds, setOrderedIds, commitOrder } = useOrderedTaskIds({
    tasks,
    selectedDay,
    onReorder: reorderTasks,
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

  // Dragging state ref (not React state - no re-renders needed)
  const isDraggingRef = useRef(false);

  // Handle drag start
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    startAutoScroll();
  }, [startAutoScroll]);

  // Handle drag end - commit order to store
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    stopAutoScroll();
    // Persist to store only on drag end
    commitOrder();
  }, [stopAutoScroll, commitOrder]);

  // Handle add new task
  const handleAddTask = useCallback(() => {
    addTask(selectedDay, "Nueva tarea", "work" as DefaultTopicId);

    // Auto-scroll to bottom after adding
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);
  }, [selectedDay, addTask, containerRef]);

  // Handle TaskEditor expansion - auto-scroll to show expanded content
  // Skip if currently dragging to avoid conflicts
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

  // Empty state
  if (tasks.length === 0) {
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
            <p className="text-lg text-white/60">No hay tareas para este día</p>
            <p className="text-sm text-white/40 mt-1">
              Haz clic en el botón para añadir una
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
          <span className="text-sm font-medium">Añadir tarea</span>
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
      {/* Scrollable TaskEditor List with Reorder */}
      <Reorder.Group
        ref={containerRef as React.RefObject<HTMLUListElement>}
        axis="y"
        values={orderedIds}
        onReorder={setOrderedIds}
        data-testid="tasks-scroll-container"
        className="flex-1 overflow-y-auto space-y-4 pr-4 pl-10 tasks-scrollbar"
        layoutScroll
      >
        {orderedIds.map((taskId) => {
          const task = taskMap.get(taskId);
          if (!task) return null;

          return (
            <ReorderableTaskItem
              key={task.id}
              task={task}
              onExpand={handleTaskExpand}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              updatePointerY={updatePointerPosition}
            />
          );
        })}
      </Reorder.Group>

      {/* Add Task Button - Always at the bottom */}
      <button
        type="button"
        data-testid="add-task-button"
        onClick={handleAddTask}
        aria-label="Add new task"
        className="
          flex items-center justify-center gap-2 p-4 mt-4 ml-10 mr-4
          rounded-2xl border-2 border-dashed border-white/20
          text-white/50 hover:text-white/80 hover:border-white/40
          hover:bg-white/5 transition-all duration-200 flex-shrink-0
        "
      >
        <Plus className="w-5 h-5" />
        <span className="text-sm font-medium">Añadir tarea</span>
      </button>
    </div>
  );
}
