"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useStore } from "@/shared/store";
import { TOPICS } from "@/shared/types";
import { cn } from "@/shared/lib/utils";

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
    <div className="h-full flex flex-col bg-black/20 backdrop-blur-md border-l border-white/10 w-48 min-w-[192px] relative overflow-hidden">
      {/* Month Header */}
      <div className="p-4 text-center border-b border-white/10">
        <h2 className="text-lg font-bold text-white/80">
          {format(selectedDate, "MMM")}
        </h2>
        <p className="text-xs text-white/40">{format(selectedDate, "yyyy")}</p>
      </div>

      {/* Days List with Tasks */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide py-4 space-y-2"
      >
        {days.map((day, i) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayNumber = day.getDate();
          const tasks = tasksByDay[dayNumber] || [];
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          const hasTasks = tasks.length > 0;

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

              {/* Tasks for this day */}
              {hasTasks && (
                <div className="day-tasks">
                  {tasks.map((task) => {
                    const topic = TOPICS[task.topicId];
                    const color = topic?.color || "#6b7280"; // Default gray if topic doesn't exist
                    
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
