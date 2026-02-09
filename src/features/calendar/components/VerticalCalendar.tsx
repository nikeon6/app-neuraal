"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isToday } from "date-fns";
import { Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    pinnedDayKeys,
    expandDay,
    collapseDay,
    pinDay,
    unpinDay,
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

  // Month picker state
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => selectedDate.getFullYear());
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

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
  // - Click on non-expanded day → expand it (auto-collapses non-pinned days)
  // - Click on expanded non-pinned day → collapse it
  // - Click on expanded pinned day → just navigate to it
  const handleDayClick = useCallback(
    (day: Date) => {
      const dateKey: ISODate = format(day, "yyyy-MM-dd");
      const isExpanded = expandedDayKeys.includes(dateKey);
      const isPinned = pinnedDayKeys.includes(dateKey);

      if (isExpanded) {
        if (isPinned) {
          // Pinned day: just navigate, don't collapse
          setSelectedDate(day);
          setSelectedDay(day.getDate());
        } else {
          // Non-pinned expanded day: collapse it
          collapseDay(dateKey, entriesByDate);
        }
      } else {
        // Not expanded: expand (collapses non-pinned others via store)
        expandDay(dateKey, entriesByDate);
        setSelectedDate(day);
        setSelectedDay(day.getDate());
      }
    },
    [expandedDayKeys, pinnedDayKeys, setSelectedDate, setSelectedDay, expandDay, collapseDay, entriesByDate]
  );

  // Toggle pin on a day
  const handleTogglePin = useCallback(
    (e: React.MouseEvent, dateKey: ISODate) => {
      e.stopPropagation(); // Don't trigger day click
      const isPinned = pinnedDayKeys.includes(dateKey);
      if (isPinned) {
        // If day is not selected, collapsing on unpin since it was only
        // kept open by the pin — otherwise just unpin and let it stay.
        const dayDate = days.find((d) => format(d, "yyyy-MM-dd") === dateKey);
        const isDaySelected = dayDate ? isSameDay(dayDate, selectedDate) : false;
        unpinDay(dateKey, entriesByDate);
        if (!isDaySelected) {
          collapseDay(dateKey, entriesByDate);
        }
      } else {
        pinDay(dateKey);
      }
    },
    [pinnedDayKeys, pinDay, unpinDay, collapseDay, entriesByDate, days, selectedDate]
  );

  // Simple click for mobile
  const handleMobileDayClick = useCallback(
    (day: Date) => {
      setSelectedDate(day);
      setSelectedDay(day.getDate());
    },
    [setSelectedDate, setSelectedDay]
  );

  // Month picker handlers
  const handleOpenMonthPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerYear(selectedDate.getFullYear());
    setIsMonthPickerOpen((prev) => !prev);
  }, [selectedDate]);

  const handleSelectMonth = useCallback(
    (monthIndex: number) => {
      // Use day-1 as base to avoid month overflow (e.g. Jan 31 → setMonth(feb) → Mar 3)
      const newDate = new Date(pickerYear, monthIndex, 1);
      setSelectedDate(startOfMonth(newDate));
      setSelectedDay(1);
      setIsMonthPickerOpen(false);
    },
    [pickerYear, setSelectedDate, setSelectedDay]
  );

  // Close month picker on outside click
  // Uses data attribute to detect any month-picker container (works across desktop/mobile/compact)
  useEffect(() => {
    if (!isMonthPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-month-picker]')) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMonthPickerOpen]);

  // Month names for the picker
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // Month picker rendered via portal so it's never clipped by overflow-hidden containers
  const monthPickerPortal = useMemo(() => {
    if (!isMonthPickerOpen || !pickerAnchor) return null;

    const PICKER_W = 160;
    const PICKER_H = 220; // approx
    const GAP = 6;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    // Smart positioning: try below, then above, then left
    let top: number;
    let left: number;

    const spaceBelow = vh - (pickerAnchor.top + pickerAnchor.height);
    const spaceAbove = pickerAnchor.top;
    const spaceLeft = pickerAnchor.left;

    if (spaceBelow >= PICKER_H + GAP) {
      // Below the button
      top = pickerAnchor.top + pickerAnchor.height + GAP;
      left = Math.max(GAP, Math.min(pickerAnchor.left, vw - PICKER_W - GAP));
    } else if (spaceAbove >= PICKER_H + GAP) {
      // Above the button
      top = pickerAnchor.top - PICKER_H - GAP;
      left = Math.max(GAP, Math.min(pickerAnchor.left, vw - PICKER_W - GAP));
    } else if (spaceLeft >= PICKER_W + GAP) {
      // Left of the button
      top = Math.max(GAP, Math.min(pickerAnchor.top, vh - PICKER_H - GAP));
      left = pickerAnchor.left - PICKER_W - GAP;
    } else {
      // Fallback: center on screen
      top = Math.max(GAP, (vh - PICKER_H) / 2);
      left = Math.max(GAP, (vw - PICKER_W) / 2);
    }

    return { top, left };
  }, [isMonthPickerOpen, pickerAnchor]);

  return (
    <div className={cn(
      "h-full flex flex-col bg-black/20 backdrop-blur-md w-full min-w-0 relative overflow-hidden box-border",
      compact ? "border-l border-white/10" : "border-t lg:border-t-0 lg:border-l border-white/10"
    )}>
      {compact ? (
        <>
          {/* COMPACT VERTICAL: Landscape mobile — month button + day numbers */}
          <div className="relative flex-shrink-0 flex items-center justify-center py-1 border-b border-white/10" data-month-picker>
            <button
              type="button"
              onClick={handleOpenMonthPicker}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all uppercase leading-none"
            >
              {format(selectedDate, "MMM")}
            </button>
          </div>
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
        </>
      ) : (
        <>
          {/* Month Header — clickable to open month picker (desktop) */}
          <div className="hidden lg:block relative flex-shrink-0" data-month-picker>
            <button
              type="button"
              onClick={handleOpenMonthPicker}
              className="w-full p-4 text-center border-b border-white/10 transition-colors hover:bg-white/5 group"
            >
              <h2 className="text-lg font-bold text-white/80 group-hover:text-white transition-colors">
                {format(selectedDate, "MMM")}
              </h2>
              <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                {format(selectedDate, "yyyy")}
                <span className="ml-1 inline-block transition-transform group-hover:translate-y-0.5">▾</span>
              </p>
            </button>

          </div>

          {/* MOBILE: Horizontal compact calendar */}
          <div ref={mobileScrollRef} className="lg:hidden flex overflow-x-auto overflow-y-hidden scrollbar-hide py-2 px-2 gap-1">
            {/* Month button — first item in the horizontal scroll */}
            <div className="relative flex-shrink-0" data-month-picker>
              <button
                type="button"
                onClick={handleOpenMonthPicker}
                className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all duration-200 text-white/50 hover:text-white hover:bg-white/10 border border-white/10"
              >
                <span className="text-[10px] uppercase font-bold opacity-70">
                  {format(selectedDate, "yyyy")}
                </span>
                <span className="text-sm font-bold">{format(selectedDate, "MMM")}</span>
              </button>
            </div>
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

              {isExpandedDay && (() => {
                const isDayPinned = pinnedDayKeys.includes(dateKey);
                const unpinnedStyle = isSelected
                  ? "text-white/50 hover:text-white/80 hover:bg-white/15"
                  : "text-white/35 hover:text-white/60 hover:bg-white/10";
                return (
                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(e, dateKey)}
                    className={cn(
                      "absolute left-0.5 top-0.5 z-10 w-5 h-5 flex items-center justify-center rounded-md transition-all duration-200",
                      isDayPinned
                        ? "text-purple-400 bg-purple-500/20 hover:bg-purple-500/30"
                        : unpinnedStyle
                    )}
                    aria-label={isDayPinned ? "Unpin day" : "Pin day"}
                    title={isDayPinned ? "Unpin day" : "Pin day"}
                  >
                    <Pin
                      className={cn(
                        "w-3 h-3 transition-transform duration-200",
                        isDayPinned ? "rotate-0" : "-rotate-45"
                      )}
                      fill={isDayPinned ? "currentColor" : "none"}
                    />
                  </button>
                );
              })()}

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

      {/* Month picker portal — rendered at body level to avoid overflow clipping */}
      {isMonthPickerOpen && monthPickerPortal && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            data-month-picker
            className="fixed z-[200] w-[160px] rounded-xl bg-black/90 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden"
            style={{ top: monthPickerPortal.top, left: monthPickerPortal.left }}
          >
            {/* Year navigation */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-sm font-bold"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-white/80">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-sm font-bold"
              >
                ›
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-1 p-2">
              {MONTH_NAMES.map((name, idx) => {
                const isCurrent =
                  selectedDate.getMonth() === idx && selectedDate.getFullYear() === pickerYear;
                const isNow =
                  new Date().getMonth() === idx && new Date().getFullYear() === pickerYear;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    className={cn(
                      "px-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                      isCurrent
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "text-white/60 hover:text-white hover:bg-white/10",
                      isNow && !isCurrent && "ring-1 ring-primary/40"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
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
