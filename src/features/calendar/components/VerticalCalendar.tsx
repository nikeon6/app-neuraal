"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useStore } from "@/shared/store";
import { cn, getDefaultTopic } from "@/shared/lib";
import type { LegacyTask, ISODate } from "@/shared/types";

/**
 * VerticalCalendar - Responsive calendar sidebar
 * 
 * MOBILE (<lg): Compact mode
 *   - Horizontal scrollable row of days
 *   - Only shows day number + dot indicator if has tasks
 *   - No task list visible
 *   - Max height limited
 * 
 * DESKTOP (lg+): Full mode
 *   - Vertical scrollable list
 *   - Shows day info + full task list with pills
 *   - Allows task removal
 */
export function VerticalCalendar() {
  const {
    selectedDate,
    setSelectedDay,
    setSelectedDate,
    tasksByDay,
    removeTask,
  } = useStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate days for the current month
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Scroll to selected day within the calendar container only
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const selectedEl = document.getElementById(`day-${format(selectedDate, 'yyyy-MM-dd')}`);
    if (!selectedEl) return;

    // Calculate scroll position to center the selected element
    const containerHeight = container.clientHeight;
    const elementTop = selectedEl.offsetTop;
    const elementHeight = selectedEl.clientHeight;
    const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: "smooth"
    });
  }, [selectedDate]);

  const handleRemoveTask = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent, day: number, taskId: string) => {
      e.stopPropagation();
      removeTask(day, taskId);
    },
    [removeTask]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, day: number, taskId: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRemoveTask(e, day, taskId);
      }
    },
    [handleRemoveTask]
  );

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedDay(day.getDate());
  };

  return (
    <div className="h-full flex flex-col bg-black/20 backdrop-blur-md 
                    border-t lg:border-t-0 lg:border-l border-white/10 
                    w-full min-w-0 relative overflow-hidden box-border">
      {/* Month Header - hidden on mobile compact, visible on desktop */}
      <div className="hidden lg:block p-4 text-center border-b border-white/10 flex-shrink-0">
        <h2 className="text-lg font-bold text-white/80">
          {format(selectedDate, "MMM")}
        </h2>
        <p className="text-xs text-white/40">{format(selectedDate, "yyyy")}</p>
      </div>

      {/* MOBILE: Horizontal compact calendar */}
      <div
        className="lg:hidden flex overflow-x-auto overflow-y-hidden scrollbar-hide py-2 px-2 gap-1"
      >
        {days.map((day) => {
          const dateKey: ISODate = format(day, "yyyy-MM-dd");
          const dayNumber: number = day.getDate();
          const tasks: LegacyTask[] = tasksByDay[dayNumber] || [];
          const isSelected: boolean = isSameDay(day, selectedDate);
          const isCurrentDay: boolean = isToday(day);
          const hasTasks: boolean = tasks.length > 0;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center justify-center",
                "w-12 h-14 rounded-xl transition-all duration-200",
                "text-white/60 hover:bg-white/10",
                isSelected && "bg-primary text-white shadow-lg",
                isCurrentDay && !isSelected && "ring-1 ring-primary/50"
              )}
            >
              <span className="text-[10px] uppercase font-medium opacity-70">
                {format(day, "EEE")}
              </span>
              <span className="text-lg font-bold">
                {format(day, "d")}
              </span>
              {/* Dot indicator for tasks */}
              {hasTasks && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
              )}
              {hasTasks && isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* DESKTOP: Vertical full calendar with tasks */}
      <div
        ref={scrollRef}
        className="hidden lg:block flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-4 space-y-2"
      >
        {days.map((day, i) => {
          const dateKey: ISODate = format(day, "yyyy-MM-dd");
          const dayNumber: number = day.getDate();
          const tasks: LegacyTask[] = tasksByDay[dayNumber] || [];
          const isSelected: boolean = isSameDay(day, selectedDate);
          const isCurrentDay: boolean = isToday(day);
          const hasTasks: boolean = tasks.length > 0;

          return (
            <motion.div
              key={dateKey}
              id={`day-${dateKey}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleDayClick(day)}
              className={cn(
                "day-row",
                isSelected && "active",
                isCurrentDay && !isSelected && "border border-primary/50"
              )}
            >
              {/* Day info */}
              <span className="day-weekday">{format(day, "EEE")}</span>
              <span className="day-number">{format(day, "d")}</span>

              {/* Note/Task indicator */}
              {hasTasks && !isSelected && (
                <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-primary" />
              )}

              {/* Tasks for this day - DESKTOP ONLY */}
              {hasTasks && (
                <div className="day-tasks">
                  {tasks.map((task) => {
                    const topic = getDefaultTopic(task.topicId);
                    const color = topic?.color || "#6b7280";
                    
                    return (
                      <div
                        key={task.id}
                        className="task-pill"
                        data-task-id={task.id}
                      >
                        <span
                          className="dot"
                          style={{ background: color }}
                        />
                        <span
                          className={cn(
                            "task-text",
                            task.completed && "line-through opacity-50"
                          )}
                        >
                          {task.title}
                        </span>
                        <span
                          className="remove-btn"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleRemoveTask(e, dayNumber, task.id)}
                          onKeyDown={(e) => handleKeyDown(e, dayNumber, task.id)}
                          aria-label={`Eliminar tarea ${task.title}`}
                        >
                          ×
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
