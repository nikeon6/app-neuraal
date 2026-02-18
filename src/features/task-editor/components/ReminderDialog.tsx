"use client";

import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  Bell,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReminderChannel = "whatsapp" | "email" | "push" | "sms";

export interface ReminderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** Create a new reminder */
  onCreate: (
    scheduledAt: string,
    channel: ReminderChannel,
    message?: string,
  ) => void;
  /** Reschedule an existing reminder (only if activeReminderId is set) */
  onReschedule?: (scheduledAt: string) => void;
  /** Cancel an existing reminder */
  onCancel?: () => void;
  /** Whether there is an active reminder that can be rescheduled/canceled */
  hasActiveReminder: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNELS: { id: ReminderChannel; label: string }[] = [
  { id: "push", label: "Push" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the default date: tomorrow */
function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Convert Date + hour + minute to ISO UTC string. */
function toIsoUtc(date: Date, hour: number, minute: number): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Check if a date+hour+minute combination is in the past. */
function isInThePast(date: Date, hour: number, minute: number): boolean {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.getTime() <= Date.now();
}

/** Check if a calendar day is strictly before today. */
function isDayBeforeToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(year, month, day);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getTime() < today.getTime();
}

/** Get days of a month organized into weeks (Mon-start). */
function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Day of week: 0=Sun, 1=Mon, ... We want Mon=0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = lastDay.getDate();
  const cells: (number | null)[] = [];

  // Blank cells before first day
  for (let i = 0; i < startDow; i++) cells.push(null);
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete the last week
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Pad number to 2 digits */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// ScrollPicker Sub-component — custom styled replacement for native <select>
// ---------------------------------------------------------------------------

interface ScrollPickerProps {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  label: string;
}

function ScrollPicker({
  values,
  selected,
  onChange,
  label,
}: Readonly<ScrollPickerProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  // Scroll to selected item when dropdown opens
  React.useEffect(() => {
    if (isOpen && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "center" });
    }
  }, [isOpen]);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={label}
        className={cn(
          "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white min-w-[3rem] text-center",
          "hover:bg-white/10 transition-colors",
          isOpen && "ring-1 ring-sky-400/50 border-sky-400/30",
        )}
      >
        {pad2(selected)}
      </button>
      {isOpen && (
        <div
          className={cn(
            "absolute bottom-full mb-1 left-1/2 -translate-x-1/2",
            "w-14 max-h-[260px] overflow-y-auto custom-scrollbar",
            "bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl",
            "py-1 z-10",
          )}
        >
          {values.map((v) => (
            <button
              key={v}
              ref={v === selected ? selectedRef : undefined}
              type="button"
              onClick={() => {
                onChange(v);
                setIsOpen(false);
              }}
              className={cn(
                "w-full py-1.5 text-xs font-medium text-center transition-colors",
                v === selected
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80",
              )}
            >
              {pad2(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateTimePicker Sub-component
// ---------------------------------------------------------------------------

interface DateTimePickerProps {
  selectedDate: Date;
  hour: number;
  minute: number;
  onDateChange: (date: Date) => void;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}

function DateTimePicker({
  selectedDate,
  hour,
  minute,
  onDateChange,
  onHourChange,
  onMinuteChange,
}: Readonly<DateTimePickerProps>) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const grid = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);

  const selDay = selectedDate.getDate();
  const selMonth = selectedDate.getMonth();
  const selYear = selectedDate.getFullYear();

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleDayClick = useCallback(
    (day: number) => {
      const d = new Date(viewYear, viewMonth, day);
      onDateChange(d);
    },
    [viewYear, viewMonth, onDateChange],
  );

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-white/80">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_LABELS.map((wd) => (
          <span key={wd} className="text-[10px] text-white/30 font-medium">
            {wd}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((day, i) => {
          if (day === null) {
            return (
              <div
                key={`blank-w${Math.floor(i / 7)}-d${i % 7}`}
                className="h-8"
              />
            );
          }

          const isPast = isDayBeforeToday(viewYear, viewMonth, day);
          const isSelected =
            day === selDay && viewMonth === selMonth && viewYear === selYear;
          const isToday =
            day === today.day &&
            viewMonth === today.month &&
            viewYear === today.year;

          let dayStyle =
            "text-white/50 hover:bg-white/10 hover:text-white/80 border border-transparent";
          if (isPast) {
            dayStyle =
              "text-white/15 border border-transparent cursor-not-allowed";
          } else if (isSelected) {
            dayStyle = "bg-sky-500/30 text-sky-300 border border-sky-400/30";
          } else if (isToday) {
            dayStyle = "bg-white/5 text-white border border-white/10";
          }

          return (
            <button
              key={day}
              type="button"
              onClick={() => !isPast && handleDayClick(day)}
              disabled={isPast}
              aria-disabled={isPast}
              className={cn(
                "h-8 rounded-lg text-xs font-medium transition-all",
                dayStyle,
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Time picker */}
      <div className="flex items-center gap-2 pt-2">
        <Clock className="w-4 h-4 text-white/30 flex-shrink-0" />
        <div className="flex items-center gap-1">
          {/* Hour scroll picker */}
          <ScrollPicker
            values={HOURS}
            selected={hour}
            onChange={onHourChange}
            label="Hour"
          />
          <span className="text-white/30 font-bold text-sm">:</span>
          {/* Minute scroll picker */}
          <ScrollPicker
            values={MINUTES}
            selected={minute}
            onChange={onMinuteChange}
            label="Minute"
          />
        </div>
        <span className="text-[10px] text-white/25 ml-auto">
          {new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            hour,
            minute,
          ).toLocaleDateString("en", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          {pad2(hour)}:{pad2(minute)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReminderDialog Component
// ---------------------------------------------------------------------------

/**
 * ReminderDialog — modal for creating/rescheduling/canceling a reminder.
 *
 * Rendered via createPortal to escape stacking context issues from
 * parent transforms (Framer Motion). Uses a custom calendar picker
 * that matches the dark theme.
 */
export function ReminderDialog({
  open,
  onClose,
  onCreate,
  onReschedule,
  onCancel,
  hasActiveReminder,
  isSaving,
}: Readonly<ReminderDialogProps>) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [channel, setChannel] = useState<ReminderChannel>("push");
  const [validationError, setValidationError] = useState<string | null>(null);
  // Message kept as internal state for future use (field hidden in MVP)
  const message = "";

  const handleCreate = useCallback(() => {
    if (isInThePast(selectedDate, hour, minute)) {
      setValidationError(
        "The selected date and time is in the past. Please choose a future time.",
      );
      return;
    }
    setValidationError(null);
    const iso = toIsoUtc(selectedDate, hour, minute);
    onCreate(iso, channel, message.trim() || undefined);
  }, [selectedDate, hour, minute, channel, message, onCreate]);

  const handleReschedule = useCallback(() => {
    if (isInThePast(selectedDate, hour, minute)) {
      setValidationError(
        "The selected date and time is in the past. Please choose a future time.",
      );
      return;
    }
    setValidationError(null);
    const iso = toIsoUtc(selectedDate, hour, minute);
    onReschedule?.(iso);
  }, [selectedDate, hour, minute, onReschedule]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const dialogContent = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            aria-label="Close reminder dialog"
            data-dialog-backdrop=""
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[90vw] max-w-sm",
              "bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Schedule reminder"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                {hasActiveReminder ? "Manage Reminder" : "Schedule Reminder"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date/Time picker */}
            <div className="mb-3">
              <span className="text-xs text-white/50 mb-2 block">
                Date & Time
              </span>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                <DateTimePicker
                  selectedDate={selectedDate}
                  hour={hour}
                  minute={minute}
                  onDateChange={(d) => {
                    setSelectedDate(d);
                    setValidationError(null);
                  }}
                  onHourChange={(h) => {
                    setHour(h);
                    setValidationError(null);
                  }}
                  onMinuteChange={(m) => {
                    setMinute(m);
                    setValidationError(null);
                  }}
                />
              </div>
            </div>

            {/* Channel selector */}
            <label className="block mb-5">
              <span className="text-xs text-white/50 mb-1 block">Channel</span>
              <div className="flex gap-1.5 flex-wrap">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannel(ch.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      channel === ch.id
                        ? "bg-sky-500/20 border-sky-400/30 text-sky-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70",
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </label>

            {/* Validation error */}
            {validationError && (
              <p className="text-xs text-red-400 mb-3" role="alert">
                {validationError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!hasActiveReminder && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSaving}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-sky-500/20 text-sky-300 border border-sky-400/30",
                    "hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {isSaving ? "Scheduling..." : "Schedule"}
                </button>
              )}

              {hasActiveReminder && (
                <>
                  <button
                    type="button"
                    onClick={handleReschedule}
                    disabled={isSaving}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                      "bg-amber-500/20 text-amber-300 border border-amber-400/30",
                      "hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {isSaving ? "Saving..." : "Reschedule"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className={cn(
                      "py-2.5 px-4 rounded-xl text-sm font-medium transition-all",
                      "bg-red-500/10 text-red-400 border border-red-500/20",
                      "hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                    title="Cancel reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(dialogContent, document.body);
}
