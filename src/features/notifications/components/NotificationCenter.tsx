"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Brain,
  AlertTriangle,
  X,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  getUnreadCount,
} from "@/shared/api/queries";
import type { ApiNotification } from "@/shared/api/sdk";
import { cn } from "@/shared/lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationCenterProps {
  /** Called when user clicks "go to entry" — parent handles navigation */
  onNavigateToEntry?: (entryId: string, dateKey?: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Read notifications older than this are auto-hidden from the UI. */
const READ_AUTO_DISMISS_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the notification should be visible in the panel. */
function isVisible(n: ApiNotification): boolean {
  // Unread notifications are always visible regardless of age
  if (n.status === "unread") return true;
  // Read notifications are hidden after READ_AUTO_DISMISS_MS
  const age = Date.now() - new Date(n.createdAt).getTime();
  return age < READ_AUTO_DISMISS_MS;
}

/** Map notification type → human-readable label + icon */
function notifMeta(type: ApiNotification["type"]) {
  switch (type) {
    case "SUMMARY_IN_PROGRESS":
      return {
        label: "Summary in progress",
        Icon: Brain,
        color: "text-sky-400",
      };
    case "SUMMARY_DONE":
      return { label: "Summary ready", Icon: Brain, color: "text-emerald-400" };
    case "SUMMARY_FAILED":
      return {
        label: "Summary failed",
        Icon: AlertTriangle,
        color: "text-red-400",
      };
    case "REMINDER_SENT":
      return { label: "Reminder sent", Icon: Bell, color: "text-amber-400" };
    case "REMINDER_FAILED":
      return {
        label: "Reminder failed",
        Icon: AlertTriangle,
        color: "text-red-400",
      };
    case "REMINDER_CANCELED":
      return { label: "Reminder canceled", Icon: X, color: "text-white/40" };
    case "TRANSCRIPTION_IN_PROGRESS":
      return {
        label: "Transcription in progress",
        Icon: FileText,
        color: "text-sky-400",
      };
    case "TRANSCRIPTION_DONE":
      return {
        label: "Transcription ready",
        Icon: FileText,
        color: "text-emerald-400",
      };
    case "TRANSCRIPTION_FAILED":
      return {
        label: "Transcription failed",
        Icon: AlertTriangle,
        color: "text-red-400",
      };
    default:
      return { label: type, Icon: Bell, color: "text-white/50" };
  }
}

/** Extract entryId from notification payload if present. */
function getEntryId(notification: ApiNotification): string | undefined {
  const p = notification.payload as Record<string, unknown> | null | undefined;
  if (!p) return undefined;
  return typeof p.entryId === "string" ? p.entryId : undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationCenter — bell button with unread badge + dropdown panel.
 *
 * Uses TanStack Query polling (5s) for live updates.
 * Responsive: full-width panel on mobile, right-aligned on desktop.
 */
export function NotificationCenter({
  onNavigateToEntry,
}: Readonly<NotificationCenterProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Position state for the portal-rendered panel
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 340,
  });

  // Data
  const { data: notifications, isLoading } = useNotificationsQuery();
  const unreadCount = getUnreadCount(notifications);
  const markReadMutation = useMarkNotificationReadMutation();

  // Calculate position when opening / on scroll/resize
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 340;
    // Align right edge of panel with right edge of button
    let left = rect.right - panelWidth;
    // Ensure panel doesn't go off-screen left
    if (left < 8) left = 8;
    setPanelPos({
      top: rect.bottom + 8,
      left,
      width: panelWidth,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    globalThis.addEventListener("scroll", updatePosition, true);
    globalThis.addEventListener("resize", updatePosition);
    return () => {
      globalThis.removeEventListener("scroll", updatePosition, true);
      globalThis.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close panel on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const handleMarkAllRead = useCallback(() => {
    if (!notifications) return;
    const unread = notifications.filter((n) => n.status === "unread");
    for (const n of unread) {
      markReadMutation.mutate(n.id);
    }
  }, [notifications, markReadMutation]);

  const handleGoToEntry = useCallback(
    (entryId: string) => {
      onNavigateToEntry?.(entryId);
      setIsOpen(false);
    },
    [onNavigateToEntry],
  );

  // Filter out read notifications older than 24h, then sort descending by createdAt
  const sorted = React.useMemo(() => {
    if (!notifications) return [];
    return notifications
      .filter(isVisible)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [notifications]);
  const notificationsAriaLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications";

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={notificationsAriaLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0",
          "border backdrop-blur-sm",
          isOpen
            ? "bg-white/10 border-white/20 text-white"
            : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:border-white/15 hover:text-white/80",
        )}
      >
        <Bell className="w-4 h-4" />
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-sky-500 text-white border-2 border-background"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel — rendered via portal to escape overflow clipping */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: panelPos.top,
                  left: panelPos.left,
                  width: panelPos.width,
                  maxWidth: "calc(100vw - 1rem)",
                  zIndex: 9999,
                }}
                className={cn(
                  "bg-background/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl",
                  "overflow-hidden isolate",
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white">
                    Notifications
                  </h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <>
                        <span className="text-xs text-sky-400 font-medium">
                          {unreadCount} unread
                        </span>
                        <button
                          type="button"
                          aria-label="Mark all read"
                          onClick={handleMarkAllRead}
                          disabled={markReadMutation.isPending}
                          className="p-1.5 rounded-lg text-emerald-400/70 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                          title="Mark all as read"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* List */}
                <div
                  className="max-h-[360px] overflow-y-auto custom-scrollbar isolate"
                  aria-label="Notifications list"
                  aria-busy={isLoading}
                >
                  {isLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-sky-400 rounded-full animate-spin" />
                    </div>
                  )}

                  {!isLoading && sorted.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-white/40">
                      No notifications yet.
                    </div>
                  )}

                  {sorted.map((n) => {
                    const meta = notifMeta(n.type);
                    const entryId = getEntryId(n);
                    const isUnread = n.status === "unread";

                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex gap-3 px-4 py-3 border-b border-white/5 transition-colors [backface-visibility:hidden]",
                          isUnread
                            ? "bg-sky-500/5 hover:bg-sky-500/10"
                            : "hover:bg-white/5",
                        )}
                      >
                        {/* Type icon */}
                        <div className={cn("mt-0.5 flex-shrink-0", meta.color)}>
                          <meta.Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn("text-xs font-medium", meta.color)}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-white/30 whitespace-nowrap flex-shrink-0">
                              {formatDistanceToNow(new Date(n.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-white/80 truncate mt-0.5">
                            {n.title}
                          </p>
                          {n.message && n.message !== n.title && (
                            <p className="text-xs text-white/40 truncate mt-0.5">
                              {n.message}
                            </p>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {entryId && (
                              <button
                                type="button"
                                onClick={() => handleGoToEntry(entryId)}
                                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Go to entry
                              </button>
                            )}
                            {isUnread && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(n.id)}
                                disabled={markReadMutation.isPending}
                                className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60 transition-colors disabled:opacity-40"
                              >
                                <Check className="w-3 h-3" />
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unread dot */}
                        {isUnread && (
                          <div className="mt-1.5 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-sky-400 block" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
