"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Bell, Trash2 } from "lucide-react";
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
  onCreate: (scheduledAt: string, channel: ReminderChannel, message?: string) => void;
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
// Helpers
// ---------------------------------------------------------------------------

const CHANNELS: { id: ReminderChannel; label: string }[] = [
  { id: "push", label: "Push" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "sms", label: "SMS" },
];

/** Build the default datetime-local value: tomorrow at 09:00 in local time. */
function defaultDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  // datetime-local needs "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert datetime-local string (local) to ISO UTC string. */
function toIsoUtc(dtLocal: string): string {
  return new Date(dtLocal).toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReminderDialog — modal for creating/rescheduling/canceling a reminder.
 *
 * Minimal MVP dialog (no external modal lib). Uses a backdrop overlay and
 * Framer Motion for entrance/exit animation.
 */
export function ReminderDialog({
  open,
  onClose,
  onCreate,
  onReschedule,
  onCancel,
  hasActiveReminder,
  isSaving,
}: ReminderDialogProps) {
  const [dateTime, setDateTime] = useState(defaultDateTime);
  const [channel, setChannel] = useState<ReminderChannel>("push");
  const [message, setMessage] = useState("");

  const handleCreate = useCallback(() => {
    const iso = toIsoUtc(dateTime);
    onCreate(iso, channel, message.trim() || undefined);
  }, [dateTime, channel, message, onCreate]);

  const handleReschedule = useCallback(() => {
    const iso = toIsoUtc(dateTime);
    onReschedule?.(iso);
  }, [dateTime, onReschedule]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
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
              "bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5"
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
            <label className="block mb-3">
              <span className="text-xs text-white/50 mb-1 block">Date & Time</span>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10",
                    "focus:outline-none focus:ring-1 focus:ring-sky-400/50 focus:border-sky-400/30",
                    "[color-scheme:dark]"
                  )}
                />
              </div>
            </label>

            {/* Channel selector */}
            <label className="block mb-3">
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
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </label>

            {/* Message (optional) */}
            <label className="block mb-4">
              <span className="text-xs text-white/50 mb-1 block">Message (optional)</span>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Reminder message..."
                maxLength={200}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 placeholder:text-white/20",
                  "focus:outline-none focus:ring-1 focus:ring-sky-400/50 focus:border-sky-400/30"
                )}
              />
            </label>

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
                    "hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
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
                      "hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
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
                      "hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
}
