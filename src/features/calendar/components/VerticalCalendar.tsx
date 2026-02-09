"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/shared/store";
import { cn } from "@/shared/lib";
import { ConfirmDialog } from "@/shared/ui";
import type { ISODate } from "@/shared/types";
import type { ApiEntry } from "@/shared/api/sdk";
import { useTopicsQuery } from "@/shared/api/queries";
import { deleteEntryAndInvalidate } from "@/shared/api/mutations";

// Type for entry pending deletion
interface EntryToDelete {
  dateKey: string;
  entryId: string;
  entryTitle: string;
}

/**
 * VerticalCalendar - Responsive calendar sidebar
 *
 * MOBILE (<lg): Compact mode
 * DESKTOP (lg+): Collapsed/Expanded mode
 */
interface VerticalCalendarProps {
  /** Entries by date (from TanStack Query). */
  entriesByDate: Record<string, ApiEntry[]>;
  /** Compact vertical mode for landscape mobile. */
  compact?: boolean;
}

export function VerticalCalendar({ entriesByDate, compact = false }: Readonly<VerticalCalendarProps>) {
  const queryClient = useQueryClient();
  const {
    selectedDate,
    setSelectedDay,
    setSelectedDate,
    selectedTopicIds,
    expandedDayKeys,
    expandDay,
    collapseDay,
  } = useStore();

  const { data: topics = [] } = useTopicsQuery();

  const scrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const compactScrollRef = useRef<HTMLDivElement>(null);
  const [visibleDays, setVisibleDays] = useState<Set<string>>(new Set());
  const visibleDaysRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  // Delete confirmation state
  const [entryToDelete, setEntryToDelete] = useState<EntryToDelete | null>(null);

  const topicColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of topics) {
      map.set(t.id, t.color);
    }
    return map;
  }, [topics]);

  // Generate days for the current month
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Scroll to selected day (desktop vertical)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const selectedEl = document.getElementById(`day-${format(selectedDate, 'yyyy-MM-dd')}`);
    if (!selectedEl) return;

    const containerHeight = container.clientHeight;
    const elementTop = selectedEl.offsetTop;
    const elementHeight = selectedEl.clientHeight;
    const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: "smooth"
    });
  }, [selectedDate]);

  // Scroll to selected day (mobile horizontal) — centers the day button
  useEffect(() => {
    const container = mobileScrollRef.current;
    if (!container) return;

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const dayEl = container.querySelector(`[data-date-key="${dateKey}"]`) as HTMLElement | null;
    if (!dayEl) return;

    const containerWidth = container.clientWidth;
    const elementLeft = dayEl.offsetLeft;
    const elementWidth = dayEl.clientWidth;
    const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);

    container.scrollTo({
      left: Math.max(0, scrollLeft),
      behavior: "smooth"
    });
  }, [selectedDate]);

  // Scroll to selected day (compact vertical mode) — centers vertically
  useEffect(() => {
    if (!compact) return;
    const container = compactScrollRef.current;
    if (!container) return;

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const dayEl = container.querySelector(`[data-date-key="${dateKey}"]`) as HTMLElement | null;
    if (!dayEl) return;

    const containerHeight = container.clientHeight;
    const elementTop = dayEl.offsetTop;
    const elementHeight = dayEl.clientHeight;
    const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: "smooth"
    });
  }, [selectedDate, compact]);

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const scheduleUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
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
        if (changed) scheduleUpdate();
      },
      {
        root: container,
        rootMargin: "100px 0px",
        threshold: 0,
      }
    );

    const dayRows = container.querySelectorAll('[data-day-anchor="true"]');
    dayRows.forEach((row) => observerRef.current?.observe(row));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observerRef.current?.disconnect();
    };
  }, [days.length]);

  // Handle entry removal - opens confirmation dialog
  const handleRemoveEntryClick = useCallback(
    (e: React.MouseEvent, dateKey: string, entryId: string, entryTitle: string) => {
      e.stopPropagation();
      setEntryToDelete({ dateKey, entryId, entryTitle });
    },
    []
  );

  // Confirm entry removal
  const handleConfirmDelete = useCallback(() => {
    if (entryToDelete) {
      void deleteEntryAndInvalidate(queryClient, entryToDelete.entryId, entryToDelete.dateKey);
      setEntryToDelete(null);
    }
  }, [entryToDelete, queryClient]);

  // Cancel entry removal
  const handleCancelDelete = useCallback(() => {
    setEntryToDelete(null);
  }, []);

  // Handle day click: expand/collapse
  const handleDayClick = useCallback(
    (day: Date) => {
      const dateKey: ISODate = format(day, "yyyy-MM-dd");
      const isExpanded = expandedDayKeys.includes(dateKey);
      const isSelected = isSameDay(day, selectedDate);

      if (isExpanded) {
        if (isSelected) {
          collapseDay(dateKey, entriesByDate);
        } else {
          setSelectedDate(day);
          setSelectedDay(day.getDate());
        }
      } else {
        expandDay(dateKey, entriesByDate);
        setSelectedDate(day);
        setSelectedDay(day.getDate());
      }
    },
    [expandedDayKeys, selectedDate, setSelectedDate, setSelectedDay, expandDay, collapseDay, entriesByDate]
  );

  // Simple click for mobile
  const handleMobileDayClick = useCallback(
    (day: Date) => {
      setSelectedDate(day);
      setSelectedDay(day.getDate());
    },
    [setSelectedDate, setSelectedDay]
  );

  return (
    <div className={cn(
      "h-full flex flex-col bg-black/20 backdrop-blur-md w-full min-w-0 relative overflow-hidden box-border",
      compact ? "border-l border-white/10" : "border-t lg:border-t-0 lg:border-l border-white/10"
    )}>
      {compact ? (
        /* COMPACT VERTICAL: Landscape mobile — just day numbers in a narrow column */
        <div
          ref={compactScrollRef}
          className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-hide py-1 gap-0.5"
        >
          {days.map((day) => {
            const dateKey: ISODate = format(day, "yyyy-MM-dd");
            const dayEntries: ApiEntry[] = entriesByDate[dateKey] || [];
            const isSelected: boolean = isSameDay(day, selectedDate);
            const isCurrentDay: boolean = isToday(day);
            const hasEntries: boolean = dayEntries.length > 0;

            return (
              <button
                key={dateKey}
                type="button"
                data-day-anchor="true"
                data-date-key={dateKey}
                data-day-number={day.getDate()}
                onClick={() => handleMobileDayClick(day)}
                className={cn(
                  "relative flex-shrink-0 flex items-center justify-center",
                  "w-8 h-8 rounded-lg transition-all duration-200 text-xs font-bold",
                  "text-white/60 hover:bg-white/10",
                  isSelected && "bg-primary text-white shadow-lg",
                  isCurrentDay && !isSelected && "ring-1 ring-primary/50"
                )}
              >
                {format(day, "d")}
                {hasEntries && !isSelected && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Month Header */}
          <div className="hidden lg:block p-4 text-center border-b border-white/10 flex-shrink-0">
            <h2 className="text-lg font-bold text-white/80">
              {format(selectedDate, "MMM")}
            </h2>
            <p className="text-xs text-white/40">{format(selectedDate, "yyyy")}</p>
          </div>

          {/* MOBILE: Horizontal compact calendar */}
          <div ref={mobileScrollRef} className="lg:hidden flex overflow-x-auto overflow-y-hidden scrollbar-hide py-2 px-2 gap-1">
            {days.map((day) => {
              const dateKey: ISODate = format(day, "yyyy-MM-dd");
              const dayEntries: ApiEntry[] = entriesByDate[dateKey] || [];
              const isSelected: boolean = isSameDay(day, selectedDate);
              const isCurrentDay: boolean = isToday(day);
              const hasEntries: boolean = dayEntries.length > 0;

              return (
                <button
                  key={dateKey}
                  type="button"
                  data-day-anchor="true"
                  data-date-key={dateKey}
                  data-day-number={day.getDate()}
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
                  <span className="text-lg font-bold">{format(day, "d")}</span>
                  {hasEntries && !isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
                  )}
                  {hasEntries && isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* DESKTOP: Vertical calendar with expandable entries */}
          <div
            ref={scrollRef}
            className="hidden lg:block flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-4 space-y-2"
          >
        {days.map((day, i) => {
          const dateKey: ISODate = format(day, "yyyy-MM-dd");
          const dayEntries: ApiEntry[] = entriesByDate[dateKey] || [];
          const isSelected: boolean = isSameDay(day, selectedDate);
          const isCurrentDay: boolean = isToday(day);
          const hasEntries: boolean = dayEntries.length > 0;

          const hasSelection = selectedTopicIds.length > 0;
          const isDayVisible = visibleDays.has(dateKey);
          const isExpandedDay = expandedDayKeys.includes(dateKey);
          
          // Filter entries by selected topics
          const selectedEntries = dayEntries.filter(
            (e) => e.topicId && selectedTopicIds.includes(e.topicId)
          );

          // Decide what entries to render
          let entriesToRender: ApiEntry[] = [];
          if (isDayVisible && isExpandedDay && hasEntries) {
            entriesToRender = dayEntries;
          } else if (isDayVisible && hasSelection && selectedEntries.length > 0) {
            entriesToRender = selectedEntries;
          }
          const shouldShowEntries = entriesToRender.length > 0;

          return (
            <motion.div
              key={dateKey}
              id={`day-${dateKey}`}
              data-day-anchor="true"
              data-day-number={day.getDate()}
              data-date-key={dateKey}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleDayClick(day)}
              className={cn(
                "day-row cursor-pointer",
                isSelected && "active",
                isCurrentDay && !isSelected && "border border-primary/50"
              )}
            >
              <span className="day-weekday">{format(day, "EEE")}</span>
              <span className="day-number">{format(day, "d")}</span>

              {isExpandedDay && (
                <span
                  className="absolute left-1 top-0.5 text-sm text-white/70 font-bold pointer-events-none select-none"
                  aria-hidden="true"
                  title="Expanded day"
                >
                  ›
                </span>
              )}

              {hasEntries && !isSelected && !shouldShowEntries && (
                <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-primary" />
              )}

              {shouldShowEntries && (
                <div className="day-tasks">
                  {entriesToRender.map((entry) => {
                    const color = entry.topicId
                      ? topicColorMap.get(entry.topicId) ?? "#6b7280"
                      : "#6b7280";
                    
                    return (
                      <div
                        key={entry.id}
                        className="task-pill"
                        data-task-id={entry.id}
                      >
                        <span className="dot" style={{ background: color }} />
                        <span
                          className={cn(
                            "task-text",
                            entry.completed && "line-through opacity-50"
                          )}
                        >
                          {entry.title}
                        </span>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={(e) => handleRemoveEntryClick(e, dateKey, entry.id, entry.title)}
                          aria-label={`Delete entry ${entry.title}`}
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
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={entryToDelete !== null}
        title="Delete task"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-white">{entryToDelete?.entryTitle ?? ""}</strong>?{" "}
            This action cannot be undone.
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        closeOnBackdrop={true}
        destructive={true}
        initialFocus="cancel"
      />
    </div>
  );
}
