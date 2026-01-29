"use client";

import React, { useState, useCallback, useRef } from "react";
import { Plus, GripVertical } from "lucide-react";
import { useStore } from "@/shared/store";
import { TaskEditor } from "@/features/task-editor";
import type { LegacyTask, DefaultTopicId } from "@/shared/types";
import { isDefaultTopicId } from "@/shared/lib";

// ============================================================================
// Types
// ============================================================================
interface DragState {
  taskId: string;
  startIndex: number;
  currentIndex: number;
}

// ============================================================================
// TaskEditorWrapper Component
// Wraps TaskEditor with drag functionality
// ============================================================================
interface TaskEditorWrapperProps {
  task: LegacyTask;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: (e: React.DragEvent, taskId: string, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
}

function TaskEditorWrapper({
  task,
  index,
  isDragging,
  isOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TaskEditorWrapperProps) {
  return (
    <div
      data-testid={`task-editor-wrapper-${task.id}`}
      data-completed={task.completed ? "true" : "false"}
      role="listitem"
      draggable="true"
      aria-grabbed={isDragging ? "true" : "false"}
      onDragStart={(e) => onDragStart(e, task.id, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      className={`
        group relative
        transition-all duration-200
        ${isDragging ? "opacity-50 scale-[0.98]" : ""}
        ${isOver ? "translate-y-2" : ""}
      `}
    >
      {/* Drag Handle - positioned on the left */}
      <div
        data-testid="drag-handle"
        aria-label="Drag to reorder"
        className="
          absolute -left-8 top-1/2 -translate-y-1/2
          opacity-0 group-hover:opacity-100
          text-white/30 hover:text-white/60
          cursor-grab active:cursor-grabbing
          transition-opacity duration-200
          p-1
        "
      >
        <GripVertical className="w-5 h-5" />
      </div>

      {/* TaskEditor */}
      <TaskEditor
        entryId={task.id}
        initialTitle={task.title}
        initialTopic={isDefaultTopicId(task.topicId) ? task.topicId : "auto"}
        initialEntryType="task"
        initialCompleted={task.completed}
      />
    </div>
  );
}

// ============================================================================
// TasksContainer Component
// ============================================================================

/**
 * TasksContainer - Container component for displaying and managing TaskEditors for a selected day.
 *
 * Features:
 * - Shows TaskEditor for each task of the currently selected day
 * - Scrollable list with single column layout
 * - Drag and drop reordering (vertical only)
 * - Add new task button at the bottom
 * - Invisible container (TaskEditors float over dashboard)
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

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Track task order during drag
  const taskOrderRef = useRef<string[]>([]);

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent, taskId: string, index: number) => {
      // dataTransfer may be undefined in test environment (jsdom)
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", taskId);
      }

      // Initialize task order
      taskOrderRef.current = tasks.map((t) => t.id);

      setDragState({
        taskId,
        startIndex: index,
        currentIndex: index,
      });
    },
    [tasks]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      // dataTransfer may be undefined in test environment (jsdom)
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }

      if (dragState && index !== dragOverIndex) {
        setDragOverIndex(index);
      }
    },
    [dragState, dragOverIndex]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (dragState && dragOverIndex !== null) {
        // Calculate new order
        const newOrder = [...taskOrderRef.current];
        const draggedId = dragState.taskId;
        const fromIndex = newOrder.indexOf(draggedId);

        if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
          // Remove from old position
          newOrder.splice(fromIndex, 1);
          // Insert at new position
          newOrder.splice(dragOverIndex, 0, draggedId);
          // Persist the new order
          reorderTasks(selectedDay, newOrder);
        }
      }

      setDragState(null);
      setDragOverIndex(null);
    },
    [dragState, dragOverIndex, selectedDay, reorderTasks]
  );

  // Handle drag end (cleanup)
  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDragOverIndex(null);
  }, []);

  // Handle add new task
  const handleAddTask = useCallback(() => {
    // Add a new task with default values
    addTask(selectedDay, "Nueva tarea", "work" as DefaultTopicId);
  }, [selectedDay, addTask]);

  // Empty state
  if (tasks.length === 0) {
    return (
      <div
        data-testid="tasks-container"
        role="list"
        className="flex flex-col h-full pl-10"
      >
        <div
          data-testid="tasks-scroll-container"
          className="flex-1 overflow-y-auto"
        >
          <div
            data-testid="tasks-empty-state"
            className="flex flex-col items-start py-8"
          >
            <p className="text-lg text-white/60">No hay tareas para este día</p>
            <p className="text-sm text-white/40 mt-1">Haz clic en el botón para añadir una</p>
          </div>
        </div>

        {/* Add Task Button */}
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
      className="flex flex-col h-full"
    >
      {/* Scrollable TaskEditor List */}
      <div
        data-testid="tasks-scroll-container"
        className="flex-1 overflow-y-auto space-y-4 pr-2 pl-10"
        style={{ scrollbarGutter: "stable" }}
      >
        {tasks.map((task, index) => (
          <TaskEditorWrapper
            key={task.id}
            task={task}
            index={index}
            isDragging={dragState?.taskId === task.id}
            isOver={dragOverIndex === index && dragState?.taskId !== task.id}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Add Task Button - Always at the bottom */}
      <button
        type="button"
        data-testid="add-task-button"
        onClick={handleAddTask}
        aria-label="Add new task"
        className="
          flex items-center justify-center gap-2 p-4 mt-4 ml-10
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
