"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useStore } from "@/shared/store";
import { cn, isDefaultTopicId, getDefaultTopic } from "@/shared/lib";
import type { LegacyTask, ISODate, DefaultTopicId } from "@/shared/types";

/**
 * VerticalCalendar - Responsive calendar sidebar
 * 
 * MOBILE (<lg): Compact mode
 *   - Horizontal scrollable row of days
 *   - Only shows day number + dot indicator if has tasks
 *   - No task list visible
 * 
 * DESKTOP (lg+): Collapsed/Expanded mode
 *   - Collapsed (default): Only day info, no task pills
 *   - Expanded: When topics are selected, shows task pills for visible days
 *   - Wires connect to day anchors (collapsed) or task pills (expanded)
 */
export function VerticalCalendar() {
  const {
    selectedDate,
    setSelectedDay,
    setSelectedDate,
    tasksByDay,
    removeTask,
    selectedTopicIds,
    expandedDayKeys,
    expandDay,
    collapseDay,
  } = useStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Track visible days for lazy rendering of task pills (performance optimization)
  const [visibleDays, setVisibleDays] = useState<Set<string>>(new Set());
  const visibleDaysRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rafRef = useRef<number | null>(null);

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

  // IntersectionObserver to track which days are visible in the scroll viewport
  // This enables lazy rendering of task pills only for visible days
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Throttled update function - batches visibility changes
    const scheduleUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        // Only trigger re-render if the set actually changed
        const newSet = new Set(visibleDaysRef.current);
        setVisibleDays(newSet);
      });
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const dateKey = (entry.target as HTMLElement).dataset.dateKey;
          if (!dateKey) continue;

          if (entry.isIntersecting && !visibleDaysRef.current.has(dateKey)) {
            visibleDaysRef.current.add(dateKey);
            changed = true;
          } else if (!entry.isIntersecting && visibleDaysRef.current.has(dateKey)) {
            visibleDaysRef.current.delete(dateKey);
            changed = true;
          }
        }
        if (changed) {
          scheduleUpdate();
        }
      },
      {
        root: container,
        rootMargin: "100px 0px", // Pre-load slightly outside viewport
        threshold: 0,
      }
    );

    // Observe all day rows
    const dayRows = container.querySelectorAll('[data-day-anchor="true"]');
    dayRows.forEach((row) => observerRef.current?.observe(row));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observerRef.current?.disconnect();
    };
  }, [days.length]); // Re-setup when month changes

  // Handle task removal
  const handleRemoveTask = useCallback(
    (e: React.MouseEvent, day: number, taskId: string) => {
      e.stopPropagation();
      removeTask(day, taskId);
    },
    [removeTask]
  );

  // Handle day click: expand/collapse with new toggle logic
  // - If NOT expanded: expand and select
  // - If expanded but NOT selected: just select (don't collapse)
  // - If expanded AND selected: collapse
  const handleDayClick = useCallback(
    (day: Date, dayNumber: number) => {
      const dateKey: ISODate = format(day, "yyyy-MM-dd");
      const isExpanded = expandedDayKeys.includes(dateKey);
      const isSelected = isSameDay(day, selectedDate);

      if (isExpanded) {
        if (isSelected) {
          // Second click on same expanded day: collapse it
          collapseDay(dateKey);
        } else {
          // Expanded but not selected: just select it (don't collapse)
          setSelectedDate(day);
          setSelectedDay(dayNumber);
        }
      } else {
        // Not expanded: expand it and select it
        expandDay(dateKey);
        setSelectedDate(day);
        setSelectedDay(dayNumber);
      }
    },
    [expandedDayKeys, selectedDate, setSelectedDate, setSelectedDay, expandDay, collapseDay]
  );

  // Simple click for mobile (no panel, just date selection)
  const handleMobileDayClick = useCallback(
    (day: Date) => {
      setSelectedDate(day);
      setSelectedDay(day.getDate());
    },
    [setSelectedDate, setSelectedDay]
  );

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
              // Data attributes for FloatingTopics wire connections (mobile)
              data-day-anchor="true"
              data-date-key={dateKey}
              data-day-number={dayNumber}
              onClick={() => handleMobileDayClick(day)}
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

      {/* DESKTOP: Vertical calendar with expandable tasks */}
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

          // Determine if tasks should be shown:
          const hasSelection = selectedTopicIds.length > 0;
          const isDayVisible = visibleDays.has(dateKey);
          const isExpandedDay = expandedDayKeys.includes(dateKey);
          
          // Filter tasks by selected topics
          const selectedDayTasks = tasks.filter(
            (t) => isDefaultTopicId(t.topicId) && selectedTopicIds.includes(t.topicId)
          );

          // Decide what tasks to render:
          // - If day is expanded (by click), show ALL tasks
          // - Else if there's a topic selection and day is visible, show selected topics' tasks
          // - Else show nothing
          let tasksToRender: LegacyTask[] = [];
          if (isDayVisible && isExpandedDay && hasTasks) {
            tasksToRender = tasks;
          } else if (isDayVisible && hasSelection && selectedDayTasks.length > 0) {
            tasksToRender = selectedDayTasks;
          }
          const shouldShowTasks = tasksToRender.length > 0;

          return (
            <motion.div
              key={dateKey}
              id={`day-${dateKey}`}
              // Data attributes for FloatingTopics wire connections
              data-day-anchor="true"
              data-day-number={dayNumber}
              data-date-key={dateKey}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleDayClick(day, dayNumber)}
              className={cn(
                "day-row cursor-pointer",
                isSelected && "active",
                isCurrentDay && !isSelected && "border border-primary/50"
                // NO extra highlight for topic selection - removed UX1
              )}
            >
              {/* Day info */}
              <span className="day-weekday">{format(day, "EEE")}</span>
              <span className="day-number">{format(day, "d")}</span>

              {/* Expanded day indicator (chevron) - only shows when manually expanded */}
              {isExpandedDay && (
                <span
                  className="absolute left-1 top-0.5 text-sm text-white/70 font-bold pointer-events-none select-none"
                  aria-hidden="true"
                  title="Día expandido"
                >
                  ›
                </span>
              )}

              {/* Task indicator dot (always visible if day has tasks and no tasks expanded) */}
              {hasTasks && !isSelected && !shouldShowTasks && (
                <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-primary" />
              )}

              {/* Task pills - rendered inside day row when expanded */}
              {shouldShowTasks && (
                <div className="day-tasks">
                  {tasksToRender.map((task) => {
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
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={(e) => handleRemoveTask(e, dayNumber, task.id)}
                          aria-label={`Eliminar tarea ${task.title}`}
                        >
                          ×
                        </button>
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
